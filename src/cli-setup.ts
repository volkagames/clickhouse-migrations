import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Command } from 'commander'
import { configureLogger, getLogger, type LogFormat, type MinLogLevel } from './logger'
import { displayMigrationStatus, getMigrationStatus, runMigration } from './migrate'

export type CliParameters = {
  migrationsHome: string
  dsn?: string
  host?: string
  user?: string
  password?: string
  db?: string
  dbEngine?: string
  tableEngine?: string
  timeout?: string | number
  caCert?: string
  cert?: string
  key?: string
  abortDivergent?: boolean | string
  createDatabase?: boolean | string
  logFormat?: LogFormat
  logLevel?: MinLogLevel
  logPrefix?: string
}

// Parses CLI/env booleans: handles 'false', '0', 'no', 'off', 'n' as false
const parseBoolean = (value: unknown, defaultValue = true): boolean => {
  if (value === undefined || value === null) {
    return defaultValue
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  const str = String(value).toLowerCase().trim()
  const falsyValues = ['false', '0', 'no', 'off', 'n']

  return !falsyValues.includes(str)
}

// Read version from package.json
// When compiled to lib/, we need to go up one directory to find package.json
const getVersion = (): string | undefined => {
  // __dirname in CommonJS points to lib/ after compilation, so we go up to project root
  const packageJsonPath = join(__dirname, '..', 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  return packageJson.version
}

export const setupCli = (): Command => {
  const program = new Command()

  program
    .name('clickhouse-migrations')
    .description('ClickHouse migrations.')
    .version(getVersion() ?? '')

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
      "Database engine with optional cluster config (default: \"ENGINE=Atomic\"). Examples: \"ENGINE = Replicated()\" or \"ON CLUSTER '{cluster}' ENGINE = Replicated('/clickhouse/{installation}/{cluster}/databases/{database}', '{shard}', '{replica}')\"",
      process.env.CH_MIGRATIONS_DB_ENGINE,
    )
    .option(
      '--table-engine <value>',
      'Engine for the _migrations table (default: "MergeTree"). Examples: "ReplicatedMergeTree()" or "ReplicatedMergeTree(\'/clickhouse/tables/{shard}/table_name\', \'{replica}\')"',
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
    .option(
      '--log-format <format>',
      'Log output format: console or json (default: console)',
      process.env.CH_MIGRATIONS_LOG_FORMAT,
    )
    .option(
      '--log-level <level>',
      'Minimum log level: debug, info, warn, error (default: info)',
      process.env.CH_MIGRATIONS_LOG_LEVEL,
    )
    .option(
      '--log-prefix <prefix>',
      'Log component/prefix name (default: clickhouse-migrations)',
      process.env.CH_MIGRATIONS_LOG_PREFIX,
    )
    .action(async (options: CliParameters) => {
      try {
        configureLogger({ format: options.logFormat, minLevel: options.logLevel, prefix: options.logPrefix })
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
        })
      } catch (e: unknown) {
        getLogger().error(e instanceof Error ? e.message : String(e))
        process.exit(1)
      }
    })

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
      'Engine for the _migrations table (default: "MergeTree"). Examples: "ReplicatedMergeTree()" or "ReplicatedMergeTree(\'/clickhouse/tables/{shard}/table_name\', \'{replica}\')"',
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
      '--log-format <format>',
      'Log output format: console or json (default: console)',
      process.env.CH_MIGRATIONS_LOG_FORMAT,
    )
    .option(
      '--log-level <level>',
      'Minimum log level: debug, info, warn, error (default: info)',
      process.env.CH_MIGRATIONS_LOG_LEVEL,
    )
    .option(
      '--log-prefix <prefix>',
      'Log component/prefix name (default: clickhouse-migrations)',
      process.env.CH_MIGRATIONS_LOG_PREFIX,
    )
    .action(async (options: CliParameters) => {
      try {
        configureLogger({ format: options.logFormat, minLevel: options.logLevel, prefix: options.logPrefix })
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
        })
        displayMigrationStatus(statusList)
      } catch (e: unknown) {
        getLogger().error(e instanceof Error ? e.message : String(e))
        process.exit(1)
      }
    })

  return program
}
