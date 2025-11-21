import crypto from 'node:crypto';
import fs from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { type ClickHouseClient, type ClickHouseClientConfigOptions, createClient } from '@clickhouse/client';
import { Command } from 'commander';
import { sqlSets, sqlQueries } from './sql-parse';
import type {
  MigrationBase,
  MigrationsRowData,
  CliParameters,
  QueryError,
  ConnectionConfig,
  CreateDbConfig,
  MigrationRunConfig,
} from './types/cli';

const COLORS = {
  CYAN: '\x1b[36m',
  RED: '\x1b[31m',
  RESET: '\x1b[0m',
} as const;

const MIGRATIONS_TABLE = '_migrations';

// Prevents SQL injection: validates ClickHouse identifiers and clauses
const VALIDATION_PATTERNS = {
  DB_NAME: /^[a-zA-Z_][a-zA-Z0-9_]{0,254}$/,
  DB_ENGINE: /^(ON\s+CLUSTER\s+[\w.-]+\s+)?ENGINE\s*=\s*[\w()]+(\s+COMMENT\s+'[^']*')?$/i,
  TABLE_ENGINE: /^[a-zA-Z]\w*(\([\w\s/._{}',-]+\))?$/,
  VERSION_STRING: /^\d+$/,
} as const;

const validate = (value: string, pattern: RegExp, errorMsg: string): string => {
  const trimmed = value.trim();
  if (!trimmed || !pattern.test(trimmed)) {
    throw new Error(errorMsg);
  }
  return trimmed;
};

const isQueryError = (error: unknown): error is QueryError => {
  return typeof error === 'object' && error !== null && 'message' in error;
};

const getErrorMessage = (error: unknown): string => {
  return isQueryError(error) ? error.message : String(error);
};

const log = (type: 'info' | 'error' = 'info', message: string, error?: string) => {
  if (type === 'info') {
    console.log(COLORS.CYAN, `clickhouse-migrations :`, COLORS.RESET, message);
  } else {
    console.error(
      COLORS.CYAN,
      `clickhouse-migrations :`,
      COLORS.RED,
      `Error: ${message}`,
      error ? `\n\n ${error}` : '',
    );
  }
};

// Parses CLI/env booleans: handles 'false', '0', 'no', 'off', 'n' as false
const parseBoolean = (value: unknown, defaultValue: boolean = true): boolean => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const str = String(value).toLowerCase().trim();
  const falsyValues = ['false', '0', 'no', 'off', 'n'];

  return !falsyValues.includes(str);
};

const connect = (config: ConnectionConfig): ClickHouseClient => {
  const dbParams: ClickHouseClientConfigOptions = {
    url: config.host,
    username: config.username,
    password: config.password,
    application: 'clickhouse-migrations',
  };

  if (config.dbName) {
    dbParams.database = config.dbName;
  }

  const timeoutMs = config.timeout ? Number(config.timeout) : 30000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid timeout value: ${config.timeout}. Must be a positive number in milliseconds.`);
  }
  dbParams.request_timeout = timeoutMs;

  // Validate TLS configuration: cert and key must be provided together
  if ((config.cert && !config.key) || (!config.cert && config.key)) {
    throw new Error('Both --cert and --key must be provided together');
  }

  if (config.caCert) {
    try {
      if (config.cert && config.key) {
        dbParams.tls = {
          ca_cert: fs.readFileSync(config.caCert),
          cert: fs.readFileSync(config.cert),
          key: fs.readFileSync(config.key),
        };
      } else {
        dbParams.tls = {
          ca_cert: fs.readFileSync(config.caCert),
        };
      }
    } catch (e: unknown) {
      throw new Error(`Failed to read TLS certificate files: ${getErrorMessage(e)}`);
    }
  }
  return createClient(dbParams);
};

const createDb = async (config: CreateDbConfig): Promise<void> => {
  // Connect without DB name to create it
  const client = connect({
    host: config.host,
    username: config.username,
    password: config.password,
    timeout: config.timeout,
    caCert: config.caCert,
    cert: config.cert,
    key: config.key,
  });

  try {
    await client.ping();
  } catch (e: unknown) {
    throw new Error(`Failed to connect to ClickHouse: ${getErrorMessage(e)}`);
  }

  // SQL injection guard - See: https://clickhouse.com/docs/en/sql-reference/syntax#identifiers
  validate(
    config.dbName,
    VALIDATION_PATTERNS.DB_NAME,
    'Invalid database name. Must start with a letter or underscore, contain only letters, numbers, and underscores, and be max 255 characters.',
  );

  // SQL injection guard - See: https://clickhouse.com/docs/en/sql-reference/statements/create/database
  if (config.dbEngine) {
    validate(
      config.dbEngine,
      VALIDATION_PATTERNS.DB_ENGINE,
      "Invalid db-engine parameter. Must match pattern: [ON CLUSTER <name>] ENGINE=<engine> [COMMENT '<comment>'].",
    );
  }

  // Parameterized query for defence in depth
  const baseQuery = 'CREATE DATABASE IF NOT EXISTS {name:Identifier}';
  const q = config.dbEngine ? `${baseQuery} ${config.dbEngine}` : baseQuery;

  try {
    await client.exec({
      query: q,
      query_params: {
        name: config.dbName,
      },
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    });
  } catch (e: unknown) {
    throw new Error(`Can't create the database ${config.dbName}: ${getErrorMessage(e)}`);
  }

  await client.close();
};

const initMigrationTable = async (client: ClickHouseClient, tableEngine: string = 'MergeTree'): Promise<void> => {
  // SQL injection guard: validates MergeTree engine format
  // See: https://clickhouse.com/docs/en/engines/table-engines/
  const validatedEngine = validate(tableEngine, VALIDATION_PATTERNS.TABLE_ENGINE, 'Invalid table engine');

  const q = `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      uid UUID DEFAULT generateUUIDv4(),
      version UInt32,
      checksum String,
      migration_name String,
      applied_at DateTime DEFAULT now()
    )
    ENGINE = ${validatedEngine}
    ORDER BY tuple(applied_at)`;

  try {
    await client.exec({
      query: q,
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    });
  } catch (e: unknown) {
    throw new Error(`Can't create the ${MIGRATIONS_TABLE} table: ${getErrorMessage(e)}`);
  }
};

const getMigrations = async (migrationsHome: string): Promise<{ version: number; file: string }[]> => {
  let files: string[] = [];
  try {
    files = await readdir(migrationsHome);
  } catch (_: unknown) {
    throw new Error(`No migration directory ${migrationsHome}. Please create it.`);
  }

  const migrations: MigrationBase[] = [];
  files.forEach((file: string) => {
    if (!file.endsWith('.sql')) {
      return;
    }

    const versionString = file.split('_')[0];
    const version = parseInt(versionString, 10);

    // Validate version format: non-negative integer (leading zeros OK: 000_init.sql → version 0)
    if (
      Number.isNaN(version) ||
      version < 0 ||
      !Number.isInteger(version) ||
      !VALIDATION_PATTERNS.VERSION_STRING.test(versionString)
    ) {
      throw new Error(
        `Migration name should start from a non-negative integer, example: 0_init.sql or 1_init.sql. Invalid migration: ${file}`,
      );
    }

    migrations.push({
      version,
      file,
    });
  });

  if (!migrations.length) {
    throw new Error(`No migrations in the ${migrationsHome} migrations directory`);
  }

  migrations.sort((m1, m2) => m1.version - m2.version);

  // Fail fast on duplicate versions
  for (let i = 1; i < migrations.length; i++) {
    if (migrations[i].version === migrations[i - 1].version) {
      throw new Error(
        `Found duplicate migration version ${migrations[i].version}: ${migrations[i - 1].file}, ${migrations[i].file}`,
      );
    }
  }

  return migrations;
};

// Ensures applied migrations still exist on filesystem (prevents accidental deletion)
const validateAppliedMigrations = (
  appliedMigrations: Map<number, MigrationsRowData>,
  migrations: MigrationBase[],
): void => {
  appliedMigrations.forEach((appliedMigration, version) => {
    const migrationExists = migrations.find((m) => m.version === version);
    if (!migrationExists) {
      throw new Error(
        `Migration file shouldn't be removed after apply. Please restore the migration ${appliedMigration.migration_name}.`,
      );
    }
  });
};

const executeMigrationQueries = async (
  client: ClickHouseClient,
  queries: string[],
  sets: Record<string, string>,
  migrationFile: string,
): Promise<void> => {
  for (const query of queries) {
    try {
      await client.exec({
        query: query,
        clickhouse_settings: sets,
      });
    } catch (e: unknown) {
      throw new Error(
        `the migrations ${migrationFile} has an error. Please, fix it (be sure that already executed parts of the migration would not be run second time) and re-run migration script.\n\n${getErrorMessage(e)}`,
      );
    }
  }
};

const recordMigration = async (client: ClickHouseClient, migration: MigrationBase, checksum: string): Promise<void> => {
  try {
    await client.insert({
      table: MIGRATIONS_TABLE,
      values: [
        {
          version: migration.version,
          checksum: checksum,
          migration_name: migration.file,
        },
      ],
      format: 'JSONEachRow',
    });
  } catch (e: unknown) {
    throw new Error(`Can't insert data into the ${MIGRATIONS_TABLE} table: ${getErrorMessage(e)}`);
  }
};

// Fetches applied migrations from DB and returns as Map for fast lookups
const getAppliedMigrations = async (client: ClickHouseClient): Promise<Map<number, MigrationsRowData>> => {
  let migrationQueryResult: MigrationsRowData[] = [];
  try {
    const resultSet = await client.query({
      query: `SELECT version, checksum, migration_name FROM ${MIGRATIONS_TABLE} ORDER BY version`,
      format: 'JSONEachRow',
    });
    migrationQueryResult = await resultSet.json();
  } catch (e: unknown) {
    throw new Error(`Can't select data from the ${MIGRATIONS_TABLE} table: ${getErrorMessage(e)}`);
  }

  // Map for O(1) lookups vs O(n) array scans
  const migrationsApplied = new Map<number, MigrationsRowData>();
  migrationQueryResult.forEach((row: MigrationsRowData) => {
    migrationsApplied.set(row.version, {
      version: row.version,
      checksum: row.checksum,
      migration_name: row.migration_name,
    });
  });

  return migrationsApplied;
};

const applyMigrations = async (
  client: ClickHouseClient,
  migrations: MigrationBase[],
  migrationsHome: string,
  abortDivergent: boolean = true,
): Promise<void> => {
  const migrationsApplied = await getAppliedMigrations(client);
  validateAppliedMigrations(migrationsApplied, migrations);

  const appliedMigrationsList: string[] = [];

  for (const migration of migrations) {
    const content = await readFile(`${migrationsHome}/${migration.file}`, 'utf-8');
    const checksum = crypto.createHash('md5').update(content).digest('hex');

    const appliedMigration = migrationsApplied.get(migration.version);

    if (appliedMigration) {
      // Detect modified migrations: checksum mismatch = file changed after apply
      if (appliedMigration.checksum !== checksum) {
        if (abortDivergent) {
          throw new Error(
            `Migration file shouldn't be changed after apply. Please restore content of the ${appliedMigration.migration_name} migration.`,
          );
        }
        log(
          'info',
          `Warning: applied migration ${appliedMigration.migration_name} has different checksum than the file on filesystem. Continuing due to --abort-divergent=false.`,
        );
      }
      continue;
    }

    const queries = sqlQueries(content);
    const sets = sqlSets(content);

    try {
      await executeMigrationQueries(client, queries, sets, migration.file);
    } catch (e: unknown) {
      if (appliedMigrationsList.length > 0) {
        log('info', `The migration(s) ${appliedMigrationsList.join(', ')} was successfully applied!`);
      }
      throw e;
    }

    await recordMigration(client, migration, checksum);

    appliedMigrationsList.push(migration.file);
  }

  if (appliedMigrationsList.length > 0) {
    log('info', `The migration(s) ${appliedMigrationsList.join(', ')} was successfully applied!`);
  } else {
    log('info', `No migrations to apply.`);
  }
};

const runMigration = async (config: MigrationRunConfig): Promise<void> => {
  const migrations = await getMigrations(config.migrationsHome);

  if (config.createDatabase !== false) {
    await createDb({
      host: config.host,
      username: config.username,
      password: config.password,
      dbName: config.dbName,
      dbEngine: config.dbEngine,
      timeout: config.timeout,
      caCert: config.caCert,
      cert: config.cert,
      key: config.key,
    });
  }

  const client = connect({
    host: config.host,
    username: config.username,
    password: config.password,
    dbName: config.dbName,
    timeout: config.timeout,
    caCert: config.caCert,
    cert: config.cert,
    key: config.key,
  });

  await initMigrationTable(client, config.tableEngine);

  await applyMigrations(client, migrations, config.migrationsHome, config.abortDivergent ?? true);

  await client.close();
};

const migrate = () => {
  const program = new Command();

  program.name('clickhouse-migrations').description('ClickHouse migrations.').version("1.2.0");

  program
    .command('migrate')
    .description('Apply migrations.')
    .requiredOption('--host <name>', 'Clickhouse hostname (ex: http://clickhouse:8123)', process.env.CH_MIGRATIONS_HOST)
    .requiredOption('--user <name>', 'Username', process.env.CH_MIGRATIONS_USER)
    .requiredOption('--password <password>', 'Password', process.env.CH_MIGRATIONS_PASSWORD)
    .requiredOption('--db <name>', 'Database name', process.env.CH_MIGRATIONS_DB)
    .requiredOption('--migrations-home <dir>', "Migrations' directory", process.env.CH_MIGRATIONS_HOME)
    .option(
      '--db-engine <value>',
      'ON CLUSTER and/or ENGINE clauses for database (default: "ENGINE=Atomic")',
      process.env.CH_MIGRATIONS_DB_ENGINE,
    )
    .option(
      '--table-engine <value>',
      'Engine for the _migrations table (default: "MergeTree")',
      process.env.CH_MIGRATIONS_TABLE_ENGINE,
    )
    .option(
      '--timeout <value>',
      'Client request timeout (milliseconds, default value 30000)',
      process.env.CH_MIGRATIONS_TIMEOUT,
    )
    .option('--ca-cert <path>', 'CA certificate file path', process.env.CH_MIGRATIONS_CA_CERT)
    .option('--cert <path>', 'Client certificate file path', process.env.CH_MIGRATIONS_CERT)
    .option('--key <path>', 'Client key file path', process.env.CH_MIGRATIONS_KEY)
    .option(
      '--abort-divergent <value>',
      'Abort if applied migrations have different checksums (default: true)',
      process.env.CH_MIGRATIONS_ABORT_DIVERGENT,
    )
    .option(
      '--create-database <value>',
      'Create database if it does not exist (default: true)',
      process.env.CH_MIGRATIONS_CREATE_DATABASE,
    )
    .action(async (options: CliParameters) => {
      try {
        await runMigration({
          migrationsHome: options.migrationsHome,
          host: options.host,
          username: options.user,
          password: options.password,
          dbName: options.db,
          dbEngine: options.dbEngine,
          tableEngine: options.tableEngine,
          timeout: options.timeout,
          caCert: options.caCert,
          cert: options.cert,
          key: options.key,
          abortDivergent: parseBoolean(options.abortDivergent, true),
          createDatabase: parseBoolean(options.createDatabase, true),
        });
      } catch (e: unknown) {
        log('error', e instanceof Error ? e.message : String(e));
        process.exit(1);
      }
    });

  program.parse();
};

export { migrate, runMigration };
