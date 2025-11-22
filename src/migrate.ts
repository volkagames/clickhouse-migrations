import crypto from 'node:crypto';
import fs from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { type ClickHouseClient, type ClickHouseClientConfigOptions, createClient } from '@clickhouse/client';
import { Command } from 'commander';
import { sqlSets, sqlQueries } from './sql-parse';
import { mergeConnectionConfig } from './dsn-parser';
import type {
  MigrationBase,
  MigrationsRowData,
  CliParameters,
  QueryError,
  ConnectionConfig,
  CreateDbConfig,
  MigrationRunConfig,
  MigrationStatusConfig,
  MigrationStatus,
} from './types/cli';

const COLORS = {
  CYAN: '\x1b[36m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  RESET: '\x1b[0m',
} as const;

const MIGRATIONS_TABLE = '_migrations';
const DEFAULT_TABLE_ENGINE = 'MergeTree';

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

const connect = (config: ConnectionConfig & { host: string }): ClickHouseClient => {
  const dbParams: ClickHouseClientConfigOptions = {
    url: config.host,
    application: 'clickhouse-migrations',
  };

  // Optional authentication - if not provided, uses ClickHouse server defaults
  // See: https://clickhouse.com/docs/operations/settings/settings-users
  if (config.username) {
    dbParams.username = config.username;
  }

  if (config.password) {
    dbParams.password = config.password;
  }

  // Optional database - if not provided, server defaults to 'default' database
  // See: https://clickhouse.com/docs/interfaces/http
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
  if (config.dbName) {
    validate(
      config.dbName,
      VALIDATION_PATTERNS.DB_NAME,
      'Invalid database name. Must start with a letter or underscore, contain only letters, numbers, and underscores, and be max 255 characters.',
    );
  }

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

const initMigrationTable = async (
  client: ClickHouseClient,
  tableEngine: string = DEFAULT_TABLE_ENGINE,
): Promise<void> => {
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
    if (!versionString) {
      throw new Error(
        `Migration name should start from a non-negative integer, example: 0_init.sql or 1_init.sql. Invalid migration: ${file}`,
      );
    }
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
    const current = migrations[i];
    const previous = migrations[i - 1];
    if (current && previous && current.version === previous.version) {
      throw new Error(`Found duplicate migration version ${current.version}: ${previous.file}, ${current.file}`);
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
      query: `SELECT version, checksum, migration_name, applied_at FROM ${MIGRATIONS_TABLE} ORDER BY version`,
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
      applied_at: row.applied_at,
    });
  });

  return migrationsApplied;
};

const applyMigrations = async (
  client: ClickHouseClient,
  migrations: MigrationBase[],
  migrationsHome: string,
  abortDivergent: boolean = true,
  globalSettings: Record<string, string> = {},
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

    // Merge global settings from DSN with file-specific settings
    // File-specific settings override global settings
    const mergedSettings = { ...globalSettings, ...sets };

    try {
      await executeMigrationQueries(client, queries, mergedSettings, migration.file);
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
  const conn = mergeConnectionConfig(config.dsn, {
    host: config.host,
    username: config.username,
    password: config.password,
    database: config.dbName,
  });

  if (!conn.host) {
    throw new Error('Host is required. Provide via --dsn, --host, or CH_MIGRATIONS_HOST/CH_MIGRATIONS_DSN');
  }

  const host = conn.host;
  const username = conn.username; // Optional: uses ClickHouse server defaults if not provided
  const password = conn.password; // Optional: uses ClickHouse server defaults if not provided
  const database = conn.database; // Optional: server defaults to 'default' database

  const migrations = await getMigrations(config.migrationsHome);

  if (config.createDatabase !== false) {
    await createDb({
      host,
      username,
      password,
      dbName: database,
      dbEngine: config.dbEngine,
      timeout: config.timeout,
      caCert: config.caCert,
      cert: config.cert,
      key: config.key,
    });
  }

  const client = connect({
    host,
    username,
    password,
    dbName: database,
    timeout: config.timeout,
    caCert: config.caCert,
    cert: config.cert,
    key: config.key,
  });

  await initMigrationTable(client, config.tableEngine || DEFAULT_TABLE_ENGINE);

  const settings = { ...conn.settings, ...(config.settings || {}) };

  await applyMigrations(client, migrations, config.migrationsHome, config.abortDivergent ?? true, settings);

  await client.close();
};

const getMigrationStatus = async (config: MigrationStatusConfig): Promise<MigrationStatus[]> => {
  const conn = mergeConnectionConfig(config.dsn, {
    host: config.host,
    username: config.username,
    password: config.password,
    database: config.dbName,
  });

  if (!conn.host) {
    throw new Error('Host is required. Provide via --dsn, --host, or CH_MIGRATIONS_HOST/CH_MIGRATIONS_DSN');
  }

  const host = conn.host;
  const username = conn.username; // Optional: uses ClickHouse server defaults if not provided
  const password = conn.password; // Optional: uses ClickHouse server defaults if not provided
  const database = conn.database; // Optional: server defaults to 'default' database

  const migrations = await getMigrations(config.migrationsHome);

  const client = connect({
    host,
    username,
    password,
    dbName: database,
    timeout: config.timeout,
    caCert: config.caCert,
    cert: config.cert,
    key: config.key,
  });

  // Check if migrations table exists
  let migrationsApplied: Map<number, MigrationsRowData>;
  try {
    await initMigrationTable(client, config.tableEngine || DEFAULT_TABLE_ENGINE);
    migrationsApplied = await getAppliedMigrations(client);
  } catch (e: unknown) {
    await client.close();
    throw new Error(`Failed to access migrations table: ${getErrorMessage(e)}`);
  }

  await client.close();

  // Build status array by combining migrations from filesystem and database
  const statusList: MigrationStatus[] = [];

  for (const migration of migrations) {
    const content = await readFile(`${config.migrationsHome}/${migration.file}`, 'utf-8');
    const checksum = crypto.createHash('md5').update(content).digest('hex');
    const appliedMigration = migrationsApplied.get(migration.version);

    if (appliedMigration) {
      statusList.push({
        version: migration.version,
        file: migration.file,
        applied: true,
        appliedAt: appliedMigration.applied_at,
        checksum: appliedMigration.checksum,
        checksumMatch: appliedMigration.checksum === checksum,
      });
    } else {
      statusList.push({
        version: migration.version,
        file: migration.file,
        applied: false,
      });
    }
  }

  return statusList;
};

const displayMigrationStatus = (statusList: MigrationStatus[]): void => {
  const appliedCount = statusList.filter((s) => s.applied).length;
  const pendingCount = statusList.filter((s) => !s.applied).length;
  const divergentCount = statusList.filter((s) => s.applied && s.checksumMatch === false).length;

  log('info', `Migration Status: ${appliedCount} applied, ${pendingCount} pending`);

  if (divergentCount > 0) {
    console.log(
      COLORS.YELLOW,
      `  Warning: ${divergentCount} applied migration(s) have checksum mismatches`,
      COLORS.RESET,
    );
  }

  console.log();

  statusList.forEach((status) => {
    if (status.applied) {
      const statusSymbol = status.checksumMatch === false ? COLORS.YELLOW + '⚠ ' : COLORS.GREEN + '✓ ';
      const checksumWarning = status.checksumMatch === false ? COLORS.YELLOW + ' (checksum mismatch)' : '';
      console.log(
        `${statusSymbol}${COLORS.RESET}[${status.version}] ${status.file} - applied at ${status.appliedAt}${checksumWarning}${COLORS.RESET}`,
      );
    } else {
      console.log(`${COLORS.CYAN}○${COLORS.RESET} [${status.version}] ${status.file} - pending`);
    }
  });

  console.log();
};

const migrate = () => {
  const program = new Command();

  program.name('clickhouse-migrations').description('ClickHouse migrations.').version('1.2.0');

  program
    .command('migrate')
    .description('Apply migrations.')
    .option(
      '--dsn <dsn>',
      'Connection DSN (ex: clickhouse://user:pass@localhost:8123/db)',
      process.env.CH_MIGRATIONS_DSN,
    )
    .option('--host <name>', 'Clickhouse hostname (ex: http://clickhouse:8123)', process.env.CH_MIGRATIONS_HOST)
    .option('--user <name>', 'Username', process.env.CH_MIGRATIONS_USER)
    .option('--password <password>', 'Password', process.env.CH_MIGRATIONS_PASSWORD)
    .option('--db <name>', 'Database name', process.env.CH_MIGRATIONS_DB)
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
          dsn: options.dsn,
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

  program
    .command('status')
    .description('Show migration status.')
    .option(
      '--dsn <dsn>',
      'Connection DSN (ex: clickhouse://user:pass@localhost:8123/db)',
      process.env.CH_MIGRATIONS_DSN,
    )
    .option('--host <name>', 'Clickhouse hostname (ex: http://clickhouse:8123)', process.env.CH_MIGRATIONS_HOST)
    .option('--user <name>', 'Username', process.env.CH_MIGRATIONS_USER)
    .option('--password <password>', 'Password', process.env.CH_MIGRATIONS_PASSWORD)
    .option('--db <name>', 'Database name', process.env.CH_MIGRATIONS_DB)
    .requiredOption('--migrations-home <dir>', "Migrations' directory", process.env.CH_MIGRATIONS_HOME)
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
    .action(async (options: CliParameters) => {
      try {
        const statusList = await getMigrationStatus({
          migrationsHome: options.migrationsHome,
          dsn: options.dsn,
          host: options.host,
          username: options.user,
          password: options.password,
          dbName: options.db,
          tableEngine: options.tableEngine,
          timeout: options.timeout,
          caCert: options.caCert,
          cert: options.cert,
          key: options.key,
        });
        displayMigrationStatus(statusList);
      } catch (e: unknown) {
        log('error', e instanceof Error ? e.message : String(e));
        process.exit(1);
      }
    });

  program.parse();
};

export { migrate, runMigration, getMigrationStatus, displayMigrationStatus };
