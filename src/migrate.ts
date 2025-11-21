import crypto from 'node:crypto';
import fs from 'node:fs';
import { type ClickHouseClient, type ClickHouseClientConfigOptions, createClient } from '@clickhouse/client';
import { Command } from 'commander';
import { sqlSets, sqlQueries } from './sql-parse';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json');

const log = (type: 'info' | 'error' = 'info', message: string, error?: string) => {
  if (type === 'info') {
    console.log('\x1b[36m', `clickhouse-migrations :`, '\x1b[0m', message);
  } else {
    console.error('\x1b[36m', `clickhouse-migrations :`, '\x1b[31m', `Error: ${message}`, error ? `\n\n ${error}` : '');
  }
};

const connect = (
  url: string,
  username: string,
  password: string,
  db_name?: string,
  timeout?: string,
  ca_cert?: string,
  cert?: string,
  key?: string,
): ClickHouseClient => {
  const db_params: ClickHouseClientConfigOptions = {
    url,
    username,
    password,
    application: 'clickhouse-migrations',
  };

  if (db_name) {
    db_params.database = db_name;
  }

  if (timeout) {
    db_params.request_timeout = Number(timeout);
  }

  if (ca_cert) {
    try {
      if (cert && key) {
        db_params.tls = {
          ca_cert: fs.readFileSync(ca_cert),
          cert: fs.readFileSync(cert),
          key: fs.readFileSync(key),
        };
      } else {
        db_params.tls = {
          ca_cert: fs.readFileSync(ca_cert),
        };
      }
    } catch (e: unknown) {
      log(
        'error',
        'Failed to read CA certificate file for TLS connection.',
        e instanceof Error ? e.message : String(e),
      );
      process.exit(1);
    }
  }
  return createClient(db_params);
};

const create_db = async (
  host: string,
  username: string,
  password: string,
  db_name: string,
  db_engine?: string,
  timeout?: string,
  ca_cert?: string,
  cert?: string,
  key?: string,
): Promise<void> => {
  // Don't specify database name when creating it - connect to default database
  const client = connect(host, username, password, undefined, timeout, ca_cert, cert, key);

  try {
    await client.ping();
  } catch (e: unknown) {
    log('error', `Failed to connect to ClickHouse`, (e as QueryError).message);
    process.exit(1);
  }

  // Validate db_name parameter to prevent SQL injection
  // Documentation: https://clickhouse.com/docs/en/sql-reference/syntax#identifiers
  // Valid database names: letters, numbers, underscores, max 255 chars, can't start with number
  // Examples: mydb, my_database, analytics_db
  if (db_name) {
    const validDbNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]{0,254}$/;
    if (!validDbNamePattern.test(db_name.trim())) {
      log(
        'error',
        `Invalid database name. Must start with a letter or underscore, contain only letters, numbers, and underscores, and be max 255 characters. See: https://clickhouse.com/docs/en/sql-reference/syntax#identifiers`,
      );
      process.exit(1);
    }
  }

  // In open source ClickHouse - default DB engine is "Atomic", for Cloud - "Shared". If not set, appropriate default is used.
  // Validate db_engine parameter to prevent SQL injection
  // Documentation: https://clickhouse.com/docs/en/sql-reference/statements/create/database
  // Valid format: [ON CLUSTER <cluster>] ENGINE=<engine> [COMMENT '<comment>']
  // Allowed engines: Atomic, Lazy, MySQL, MaterializedMySQL, PostgreSQL, MaterializedPostgreSQL, Replicated, SQLite
  // Examples:
  //   - ENGINE=Atomic
  //   - ON CLUSTER my_cluster ENGINE=Replicated
  //   - ENGINE=Atomic COMMENT 'Production database'
  //   - ON CLUSTER my_cluster ENGINE=Replicated COMMENT 'Replicated DB'
  if (db_engine) {
    // Allow: ENGINE=<name> or ON CLUSTER <name> ENGINE=<name> or with COMMENT
    // Valid pattern: optional "ON CLUSTER <cluster>" followed by "ENGINE=<engine>" optionally followed by "COMMENT '<text>'"
    const validPattern = /^(ON\s+CLUSTER\s+[\w.-]+\s+)?ENGINE\s*=\s*[\w()]+(\s+COMMENT\s+'[^']*')?$/i;
    if (!validPattern.test(db_engine.trim())) {
      log(
        'error',
        `Invalid db-engine parameter. Must match pattern: [ON CLUSTER <name>] ENGINE=<engine> [COMMENT '<comment>']. See: https://clickhouse.com/docs/en/sql-reference/statements/create/database`,
      );
      process.exit(1);
    }
  }

  const q = db_engine
    ? `CREATE DATABASE IF NOT EXISTS \`${db_name}\` ${db_engine}`
    : `CREATE DATABASE IF NOT EXISTS \`${db_name}\``;

  try {
    await client.exec({
      query: q,
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    });
  } catch (e: unknown) {
    log('error', `can't create the database ${db_name}.`, (e as QueryError).message);
    process.exit(1);
  }

  await client.close();
};

const init_migration_table = async (client: ClickHouseClient, table_engine: string = 'MergeTree'): Promise<void> => {
  // Validate table_engine parameter to prevent SQL injection
  // Documentation: https://clickhouse.com/docs/en/engines/table-engines/
  // Valid engines: MergeTree, ReplicatedMergeTree, ReplacingMergeTree, SummingMergeTree, etc.
  // Valid format: EngineName or EngineName('param1', 'param2')
  // Examples:
  //   - MergeTree
  //   - ReplicatedMergeTree('/clickhouse/tables/{database}/migrations', '{replica}')
  //   - ReplacingMergeTree(version_column)
  if (table_engine) {
    // Allow: engine name with optional parameters in parentheses, including cluster macros
    // Pattern: word characters followed by optional parentheses with parameters
    // Allowed characters inside params: alphanumeric, underscore, slash, dot, dash, braces, comma, single quotes, spaces
    const validEnginePattern = /^[\w]+(\([\w\s/._{}',-]*\))?$/;
    if (!validEnginePattern.test(table_engine.trim())) {
      log(
        'error',
        `Invalid table-engine parameter. Must be a valid ClickHouse engine name, optionally with parameters in parentheses. Examples: MergeTree, ReplicatedMergeTree('/path', '{replica}'). See: https://clickhouse.com/docs/en/engines/table-engines/`,
      );
      process.exit(1);
    }
  }

  const q = `CREATE TABLE IF NOT EXISTS _migrations (
      uid UUID DEFAULT generateUUIDv4(),
      version UInt32,
      checksum String,
      migration_name String,
      applied_at DateTime DEFAULT now()
    )
    ENGINE = ${table_engine}
    ORDER BY tuple(applied_at)`;

  try {
    await client.exec({
      query: q,
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    });
  } catch (e: unknown) {
    log('error', `can't create the _migrations table.`, (e as QueryError).message);
    process.exit(1);
  }
};

const get_migrations = (migrations_home: string): { version: number; file: string }[] => {
  let files: string[] = [];
  try {
    files = fs.readdirSync(migrations_home);
  } catch (_: unknown) {
    log('error', `no migration directory ${migrations_home}. Please create it.`);
    process.exit(1);
  }

  const migrations: MigrationBase[] = [];
  files.forEach((file: string) => {
    // Manage only .sql files.
    if (!file.endsWith('.sql')) {
      return;
    }

    const versionString = file.split('_')[0];
    const version = parseInt(versionString, 10);

    // Check if version is a valid non-negative integer
    // parseInt returns NaN for invalid input, and we need to ensure it's an integer
    // We allow leading zeros (e.g., 000_init.sql is valid and treated as version 0)
    if (Number.isNaN(version) || version < 0 || !Number.isInteger(version) || !/^\d+$/.test(versionString)) {
      log(
        'error',
        `a migration name should start from a non-negative integer, example: 0_init.sql or 1_init.sql. Please check, if the migration ${file} is named correctly`,
      );
      process.exit(1);
    }

    migrations.push({
      version,
      file,
    });
  });

  if (!migrations.length) {
    log('error', `no migrations in the ${migrations_home} migrations directory`);
  }

  // Order by version.
  migrations.sort((m1, m2) => m1.version - m2.version);

  // Check for duplicate versions. Since `migrations` is already sorted by version,
  // it's sufficient to check adjacent entries
  for (let i = 1; i < migrations.length; i++) {
    if (migrations[i].version === migrations[i - 1].version) {
      log(
        'error',
        `Found duplicate migration version ${migrations[i].version}: ${migrations[i - 1].file}, ${migrations[i].file}`,
      );
      process.exit(1);
    }
  }

  return migrations;
};

const apply_migrations = async (
  client: ClickHouseClient,
  migrations: MigrationBase[],
  migrations_home: string,
  abort_divergent: boolean = true,
): Promise<void> => {
  let migration_query_result: MigrationsRowData[] = [];
  try {
    const resultSet = await client.query({
      query: `SELECT version, checksum, migration_name FROM _migrations ORDER BY version`,
      format: 'JSONEachRow',
    });
    migration_query_result = await resultSet.json();
  } catch (e: unknown) {
    log('error', `can't select data from the _migrations table.`, (e as QueryError).message);
    process.exit(1);
  }

  const migrations_applied: MigrationsRowData[] = [];
  migration_query_result.forEach((row: MigrationsRowData) => {
    migrations_applied[row.version] = {
      version: row.version,
      checksum: row.checksum,
      migration_name: row.migration_name,
    };

    // Check if migration file was not removed after apply.
    const migration_exist = migrations.find(({ version }) => version === row.version);
    if (!migration_exist) {
      log(
        'error',
        `a migration file shouldn't be removed after apply. Please, restore the migration ${row.migration_name}.`,
      );
      process.exit(1);
    }
  });

  let applied_migrations = '';

  for (const migration of migrations) {
    const content = fs.readFileSync(`${migrations_home}/${migration.file}`).toString();
    const checksum = crypto.createHash('md5').update(content).digest('hex');

    if (migrations_applied[migration.version]) {
      // Check if migration file was not changed after apply.
      if (migrations_applied[migration.version].checksum !== checksum) {
        if (abort_divergent) {
          log(
            'error',
            `a migration file should't be changed after apply. Please, restore content of the ${
              migrations_applied[migration.version].migration_name
            } migrations.`,
          );
          process.exit(1);
        } else {
          log(
            'info',
            `Warning: applied migration ${migrations_applied[migration.version].migration_name} has different checksum than the file on filesystem. Continuing due to --abort-divergent=false.`,
          );
        }
      }

      // Skip if a migration is already applied.
      continue;
    }

    // Extract sql from the migration.
    const queries = sqlQueries(content);
    const sets = sqlSets(content);

    for (const query of queries) {
      try {
        await client.exec({
          query: query,
          clickhouse_settings: sets,
        });
      } catch (e: unknown) {
        if (applied_migrations) {
          log('info', `The migration(s) ${applied_migrations} was successfully applied!`);
        }

        log(
          'error',
          `the migrations ${migration.file} has an error. Please, fix it (be sure that already executed parts of the migration would not be run second time) and re-run migration script.`,
          (e as QueryError).message,
        );
        process.exit(1);
      }
    }

    try {
      await client.insert({
        table: '_migrations',
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
      log('error', `can't insert a data into the table _migrations.`, (e as QueryError).message);
      process.exit(1);
    }

    applied_migrations = applied_migrations ? `${applied_migrations}, ${migration.file}` : migration.file;
  }

  if (applied_migrations) {
    log('info', `The migration(s) ${applied_migrations} was successfully applied!`);
  } else {
    log('info', `No migrations to apply.`);
  }
};

const migration = async (
  migrations_home: string,
  host: string,
  username: string,
  password: string,
  db_name: string,
  db_engine?: string,
  table_engine?: string,
  timeout?: string,
  ca_cert?: string | undefined,
  cert?: string | undefined,
  key?: string | undefined,
  abort_divergent: boolean = true,
  create_database: boolean = true,
): Promise<void> => {
  const migrations = get_migrations(migrations_home);

  if (create_database) {
    await create_db(host, username, password, db_name, db_engine, timeout, ca_cert, cert, key);
  }

  const client = connect(host, username, password, db_name, timeout, ca_cert, cert, key);

  await init_migration_table(client, table_engine);

  await apply_migrations(client, migrations, migrations_home, abort_divergent);

  await client.close();
};

const migrate = () => {
  const program = new Command();

  program.name('clickhouse-migrations').description('ClickHouse migrations.').version(version);

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
      const abortDivergent =
        options.abortDivergent === undefined ? true : String(options.abortDivergent).toLowerCase() !== 'false';
      const createDatabase =
        options.createDatabase === undefined ? true : String(options.createDatabase).toLowerCase() !== 'false';
      await migration(
        options.migrationsHome,
        options.host,
        options.user,
        options.password,
        options.db,
        options.dbEngine,
        options.tableEngine,
        options.timeout,
        options.caCert,
        options.cert,
        options.key,
        abortDivergent,
        createDatabase,
      );
    });

  program.parse();
};

export { migrate, migration };
