import * as crypto from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { type ClickHouseClient, type ClickHouseClientConfigOptions, createClient } from '@clickhouse/client'
import { setupConnectionConfig } from './dsn-parser'
import { COLORS, getLogger } from './logger'
import { sqlQueries, sqlSets } from './sql-parse'
import type {
  ConnectionConfig,
  CreateDbConfig,
  MigrationBase,
  MigrationRunConfig,
  MigrationStatus,
  MigrationStatusConfig,
  MigrationsRowData,
  QueryError,
} from './types/cli'

const MIGRATIONS_TABLE = '_migrations'
const DEFAULT_TABLE_ENGINE = 'MergeTree'

// Prevents SQL injection: validates ClickHouse identifiers and clauses
const VALIDATION_PATTERNS = {
  // Database name: must start with letter/underscore, contain only alphanumeric and underscore, max 255 chars
  // See: https://clickhouse.com/docs/en/sql-reference/syntax#identifiers
  DB_NAME: /^[a-zA-Z_][a-zA-Z0-9_]{0,254}$/,

  // Database engine: supports replication and clustering
  // Format: [ON CLUSTER <name>] ENGINE=<engine>[(params)] [COMMENT '<comment>']
  // Examples:
  //   - ENGINE = Atomic
  //   - ENGINE = Replicated()
  //   - ON CLUSTER '{cluster}' ENGINE = Replicated('/clickhouse/{installation}/{cluster}/databases/{database}', '{shard}', '{replica}')
  // Pattern breakdown:
  //   - (ON\s+CLUSTER\s+['\w{}.,-]+\s+)? - optional cluster clause with macros like '{cluster}'
  //   - ENGINE\s*=\s*\w+ - engine name (Atomic, Replicated, etc.)
  //   - (\s*\(\s*('...'(\s*,\s*'...')*\s*)?\))? - optional parameters: empty (), or with quoted strings
  //   - (\s+COMMENT\s+'[^']*')? - optional comment
  // See: https://clickhouse.com/docs/en/sql-reference/statements/create/database
  DB_ENGINE:
    /^(ON\s+CLUSTER\s+['\w{}.,-]+\s+)?ENGINE\s*=\s*\w+(\s*\(\s*('[^']*'(\s*,\s*'[^']*')*\s*)?\))?(\s+COMMENT\s+'[^']*')?$/i,

  // Table engine: supports replicated MergeTree family engines
  // Format: EngineName[(params)]
  // Examples:
  //   - MergeTree
  //   - ReplicatedMergeTree()
  //   - ReplicatedMergeTree('/clickhouse/tables/{shard}/table_name', '{replica}')
  //   - ReplicatedReplacingMergeTree('/clickhouse/tables/{shard}/{database}/{table}', '{replica}')
  // Pattern breakdown:
  //   - [a-zA-Z]\w* - engine name starting with letter
  //   - (\s*\(\s*('...'(\s*,\s*'...')*\s*)?\))? - optional parameters: empty (), or with quoted strings
  // See: https://clickhouse.com/docs/engines/table-engines/mergetree-family/replication
  TABLE_ENGINE: /^[a-zA-Z]\w*(\s*\(\s*('[^']*'(\s*,\s*'[^']*')*\s*)?\))?$/,

  // Migration version: must be non-negative integer
  VERSION_STRING: /^\d+$/,
} as const

const validate = (value: string, pattern: RegExp, errorMsg: string): string => {
  const trimmed = value.trim()
  if (!trimmed || !pattern.test(trimmed)) {
    throw new Error(errorMsg)
  }
  return trimmed
}

// Validates migrations directory path for security and correctness
// Resolves the full absolute path to prevent path traversal issues
const validateMigrationsHome = (path: string): string => {
  // Check for null, undefined, or non-string values
  if (!path || typeof path !== 'string') {
    throw new Error('Migrations directory path is required and must be a string')
  }

  const trimmed = path.trim()

  // Check for empty or whitespace-only strings
  if (!trimmed) {
    throw new Error('Migrations directory path cannot be empty or whitespace')
  }

  // Block null bytes (directory traversal/injection technique)
  if (trimmed.includes('\0')) {
    throw new Error('Invalid migrations directory path: null bytes are not allowed')
  }

  // Resolve to absolute path - this handles .. and . automatically
  const resolvedPath = resolve(trimmed)

  // Warn about potentially dangerous absolute paths to system directories
  // This is a safety check to prevent accidental operations on system folders
  const dangerousPaths = ['/etc', '/sys', '/proc', '/dev', '/root', '/boot', '/bin', '/sbin', '/usr/bin', '/usr/sbin']
  const normalizedPath = resolvedPath.replace(/\\/g, '/').toLowerCase()

  for (const dangerousPath of dangerousPaths) {
    if (normalizedPath === dangerousPath || normalizedPath.startsWith(`${dangerousPath}/`)) {
      throw new Error(
        `Invalid migrations directory path: operations on system directory '${dangerousPath}' are not allowed`,
      )
    }
  }

  // Check for Windows absolute paths to system directories (C:\Windows, C:\System32, etc.)
  if (/^[a-z]:\\(windows|system32|program files)/i.test(resolvedPath)) {
    throw new Error('Invalid migrations directory path: operations on Windows system directories are not allowed')
  }

  return resolvedPath
}

const isQueryError = (error: unknown): error is QueryError => {
  return typeof error === 'object' && error !== null && 'message' in error
}

const getErrorMessage = (error: unknown): string => {
  return isQueryError(error) ? error.message : String(error)
}

/**
 * Sanitizes error messages to prevent leaking sensitive information like passwords.
 * Removes potential credentials from URLs and connection strings.
 *
 * @param message - The error message to sanitize
 * @returns The sanitized error message with credentials redacted
 *
 * @example
 * ```typescript
 * sanitizeErrorMessage('Failed to connect to http://user:password@localhost')
 * // Returns: 'Failed to connect to http://user:[REDACTED]@localhost'
 * ```
 */
export const sanitizeErrorMessage = (message: string): string => {
  // Remove passwords from URLs (http://user:password@host -> http://user:[REDACTED]@host)
  // Match protocol://user:password@host pattern
  // This handles special characters by matching non-whitespace after the colon until @
  let sanitized = message.replace(/((?:https?|clickhouse):\/\/[^:/@\s]+:)([^@\s]+)(@)/gi, '$1[REDACTED]$3')

  // Remove passwords from connection strings (password=xxx, password='xxx', password: xxx)
  sanitized = sanitized.replace(/(password\s*[:=]\s*['"]?)([^'",\s}]+)(['"]?)/gi, '$1[REDACTED]$3')

  // Remove authorization headers (handles "Bearer token" and similar patterns)
  sanitized = sanitized.replace(/(authorization\s*[:=]\s*)(['"]?)([^\s'",}]+)(['"]?)/gi, '$1$2[REDACTED]$4')

  // Remove basic auth tokens
  sanitized = sanitized.replace(/(basic\s+)([a-zA-Z0-9+/]+=*)/gi, '$1[REDACTED]')

  return sanitized
}

const connect = async (config: ConnectionConfig & { host: string }): Promise<ClickHouseClient> => {
  const dbParams: ClickHouseClientConfigOptions = {
    url: config.host,
    application: 'clickhouse-migrations',
  }

  // Optional authentication - if not provided, uses ClickHouse server defaults
  // See: https://clickhouse.com/docs/operations/settings/settings-users
  if (config.username) {
    dbParams.username = config.username
  }

  if (config.password) {
    dbParams.password = config.password
  }

  // Optional database - if not provided, server defaults to 'default' database
  // See: https://clickhouse.com/docs/interfaces/http
  if (config.dbName) {
    dbParams.database = config.dbName
  }

  const timeoutMs = config.timeout ? Number(config.timeout) : 30000
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid timeout value: ${config.timeout}. Must be a positive number in milliseconds.`)
  }
  dbParams.request_timeout = timeoutMs

  // Validate TLS configuration: cert and key must be provided together
  if ((config.cert && !config.key) || (!config.cert && config.key)) {
    throw new Error('Both --cert and --key must be provided together')
  }

  if (config.caCert) {
    try {
      if (config.cert && config.key) {
        dbParams.tls = {
          ca_cert: await readFile(config.caCert),
          cert: await readFile(config.cert),
          key: await readFile(config.key),
        }
      } else {
        dbParams.tls = {
          ca_cert: await readFile(config.caCert),
        }
      }
    } catch (e: unknown) {
      throw new Error(`Failed to read TLS certificate files: ${getErrorMessage(e)}`)
    }
  }
  return createClient(dbParams)
}

const createDb = async (config: CreateDbConfig): Promise<void> => {
  // Connect without DB name to create it
  const client = await connect({
    host: config.host,
    username: config.username,
    password: config.password,
    timeout: config.timeout,
    caCert: config.caCert,
    cert: config.cert,
    key: config.key,
  })

  try {
    await client.ping()
  } catch (e: unknown) {
    await client.close()
    throw new Error(`Failed to connect to ClickHouse: ${sanitizeErrorMessage(getErrorMessage(e))}`)
  }

  // SQL injection guard - See: https://clickhouse.com/docs/en/sql-reference/syntax#identifiers
  if (config.dbName) {
    validate(
      config.dbName,
      VALIDATION_PATTERNS.DB_NAME,
      'Invalid database name. Must start with a letter or underscore, contain only letters, numbers, and underscores, and be max 255 characters.',
    )
  }

  // SQL injection guard - See: https://clickhouse.com/docs/en/sql-reference/statements/create/database
  if (config.dbEngine) {
    validate(
      config.dbEngine,
      VALIDATION_PATTERNS.DB_ENGINE,
      "Invalid db-engine parameter. Must match pattern: [ON CLUSTER <name>] ENGINE=<engine>[(params)] [COMMENT '<comment>']. Example: ON CLUSTER '{cluster}' ENGINE = Replicated('/clickhouse/{installation}/{cluster}/databases/{database}', '{shard}', '{replica}')",
    )
  }

  // Parameterized query for defence in depth
  const baseQuery = 'CREATE DATABASE IF NOT EXISTS {name:Identifier}'
  const q = config.dbEngine ? `${baseQuery} ${config.dbEngine}` : baseQuery

  try {
    await client.exec({
      query: q,
      query_params: {
        name: config.dbName,
      },
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    })
  } catch (e: unknown) {
    await client.close()
    throw new Error(`Can't create the database ${config.dbName}: ${sanitizeErrorMessage(getErrorMessage(e))}`)
  }

  await client.close()
}

const initMigrationTable = async (
  client: ClickHouseClient,
  tableEngine: string = DEFAULT_TABLE_ENGINE,
): Promise<void> => {
  // SQL injection guard: validates MergeTree engine format
  // See: https://clickhouse.com/docs/en/engines/table-engines/
  const validatedEngine = validate(
    tableEngine,
    VALIDATION_PATTERNS.TABLE_ENGINE,
    "Invalid table engine. Must match pattern: EngineName[(params)]. Example: ReplicatedMergeTree('/clickhouse/tables/{shard}/table_name', '{replica}')",
  )

  const q = `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      uid UUID DEFAULT generateUUIDv4(),
      version UInt32,
      checksum String,
      migration_name String,
      applied_at DateTime DEFAULT now()
    )
    ENGINE = ${validatedEngine}
    ORDER BY tuple(applied_at)`

  try {
    await client.exec({
      query: q,
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    })
  } catch (e: unknown) {
    throw new Error(`Can't create the ${MIGRATIONS_TABLE} table: ${getErrorMessage(e)}`)
  }
}

const getMigrations = async (migrationsHome: string): Promise<{ version: number; file: string }[]> => {
  // Validate the migrations directory path for security
  const validatedPath = validateMigrationsHome(migrationsHome)

  let files: string[] = []
  try {
    files = await readdir(validatedPath)
  } catch (_: unknown) {
    throw new Error(`No migration directory ${validatedPath}. Please create it.`)
  }

  const migrations: MigrationBase[] = []
  for (const file of files) {
    if (!file.endsWith('.sql')) {
      continue
    }

    const versionString = file.split('_')[0]
    if (!versionString) {
      throw new Error(
        `Migration name should start from a non-negative integer, example: 0_init.sql or 1_init.sql. Invalid migration: ${file}`,
      )
    }
    const version = Number.parseInt(versionString, 10)

    // Validate version format: non-negative integer (leading zeros OK: 000_init.sql → version 0)
    if (
      Number.isNaN(version) ||
      version < 0 ||
      !Number.isInteger(version) ||
      !VALIDATION_PATTERNS.VERSION_STRING.test(versionString)
    ) {
      throw new Error(
        `Migration name should start from a non-negative integer, example: 0_init.sql or 1_init.sql. Invalid migration: ${file}`,
      )
    }

    migrations.push({
      version,
      file,
    })
  }

  if (!migrations.length) {
    throw new Error(`No migrations in the ${validatedPath} migrations directory`)
  }

  migrations.sort((m1, m2) => m1.version - m2.version)

  // Fail fast on duplicate versions
  for (let i = 1; i < migrations.length; i++) {
    const current = migrations[i]
    const previous = migrations[i - 1]
    if (current && previous && current.version === previous.version) {
      throw new Error(`Found duplicate migration version ${current.version}: ${previous.file}, ${current.file}`)
    }
  }

  return migrations
}

// Ensures applied migrations still exist on filesystem (prevents accidental deletion)
const validateAppliedMigrations = (
  appliedMigrations: Map<number, MigrationsRowData>,
  migrations: MigrationBase[],
): void => {
  appliedMigrations.forEach((appliedMigration, version) => {
    const migrationExists = migrations.find((m) => m.version === version)
    if (!migrationExists) {
      throw new Error(
        `Migration file shouldn't be removed after apply. Please restore the migration ${appliedMigration.migration_name}.`,
      )
    }
  })
}

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
      })
    } catch (e: unknown) {
      throw new Error(
        `the migrations ${migrationFile} has an error. Please, fix it (be sure that already executed parts of the migration would not be run second time) and re-run migration script.\n\n${getErrorMessage(e)}`,
      )
    }
  }
}

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
    })
  } catch (e: unknown) {
    throw new Error(`Can't insert data into the ${MIGRATIONS_TABLE} table: ${getErrorMessage(e)}`)
  }
}

// Fetches applied migrations from DB and returns as Map for fast lookups
const getAppliedMigrations = async (client: ClickHouseClient): Promise<Map<number, MigrationsRowData>> => {
  let migrationQueryResult: MigrationsRowData[] = []
  try {
    const resultSet = await client.query({
      query: `SELECT version, checksum, migration_name, applied_at FROM ${MIGRATIONS_TABLE} ORDER BY version`,
      format: 'JSONEachRow',
    })
    migrationQueryResult = await resultSet.json()
  } catch (e: unknown) {
    throw new Error(`Can't select data from the ${MIGRATIONS_TABLE} table: ${getErrorMessage(e)}`)
  }

  // Map for O(1) lookups vs O(n) array scans
  const migrationsApplied = new Map<number, MigrationsRowData>()
  for (const row of migrationQueryResult) {
    migrationsApplied.set(row.version, {
      version: row.version,
      checksum: row.checksum,
      migration_name: row.migration_name,
      applied_at: row.applied_at,
    })
  }

  return migrationsApplied
}

const applyMigrations = async (
  client: ClickHouseClient,
  migrations: MigrationBase[],
  migrationsHome: string,
  abortDivergent = true,
  globalSettings: Record<string, string> = {},
): Promise<void> => {
  // Validate the migrations directory path for security
  const validatedPath = validateMigrationsHome(migrationsHome)

  const migrationsApplied = await getAppliedMigrations(client)
  validateAppliedMigrations(migrationsApplied, migrations)

  const appliedMigrationsList: string[] = []

  for (const migration of migrations) {
    const content = await readFile(`${validatedPath}/${migration.file}`, 'utf-8')
    const checksum = crypto.createHash('md5').update(content).digest('hex')

    const appliedMigration = migrationsApplied.get(migration.version)

    if (appliedMigration) {
      // Detect modified migrations: checksum mismatch = file changed after apply
      if (appliedMigration.checksum !== checksum) {
        if (abortDivergent) {
          throw new Error(
            `Migration file shouldn't be changed after apply. Please restore content of the ${appliedMigration.migration_name} migration.`,
          )
        }
        getLogger().warn(
          `applied migration ${appliedMigration.migration_name} has different checksum than the file on filesystem. Continuing due to --abort-divergent=false.`,
        )
      }
      continue
    }

    const queries = sqlQueries(content)
    const sets = sqlSets(content)

    // Merge global settings from DSN with file-specific settings
    // File-specific settings override global settings
    const mergedSettings = { ...globalSettings, ...sets }

    try {
      await executeMigrationQueries(client, queries, mergedSettings, migration.file)
    } catch (e: unknown) {
      if (appliedMigrationsList.length > 0) {
        getLogger().info(`The migration(s) ${appliedMigrationsList.join(', ')} was successfully applied!`)
      }
      throw e
    }

    await recordMigration(client, migration, checksum)

    appliedMigrationsList.push(migration.file)
  }

  if (appliedMigrationsList.length > 0) {
    getLogger().info(`The migration(s) ${appliedMigrationsList.join(', ')} was successfully applied!`)
  } else {
    getLogger().info(`No migrations to apply.`)
  }
}

const runMigration = async (config: MigrationRunConfig): Promise<void> => {
  const conn = setupConnectionConfig(config.dsn, {
    host: config.host,
    username: config.username,
    password: config.password,
    database: config.dbName,
    settings: config.settings,
  })

  if (!conn.host) {
    throw new Error('Host is required. Provide via --dsn, --host, or CH_MIGRATIONS_HOST/CH_MIGRATIONS_DSN')
  }

  const host = conn.host
  const username = conn.username // Optional: uses ClickHouse server defaults if not provided
  const password = conn.password // Optional: uses ClickHouse server defaults if not provided
  const database = conn.database // Optional: server defaults to 'default' database

  const migrations = await getMigrations(config.migrationsHome)

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
    })
  }

  const client = await connect({
    host,
    username,
    password,
    dbName: database,
    timeout: config.timeout,
    caCert: config.caCert,
    cert: config.cert,
    key: config.key,
  })

  // Verify connection before proceeding
  try {
    await client.ping()
  } catch (e: unknown) {
    await client.close()
    throw new Error(`Failed to connect to ClickHouse at ${host}: ${sanitizeErrorMessage(getErrorMessage(e))}`)
  }

  try {
    await initMigrationTable(client, config.tableEngine || DEFAULT_TABLE_ENGINE)

    const settings = { ...conn.settings, ...(config.settings || {}) }

    await applyMigrations(client, migrations, config.migrationsHome, config.abortDivergent ?? true, settings)
  } catch (e: unknown) {
    await client.close()
    throw e
  }

  await client.close()
}

const getMigrationStatus = async (config: MigrationStatusConfig): Promise<MigrationStatus[]> => {
  const conn = setupConnectionConfig(config.dsn, {
    host: config.host,
    username: config.username,
    password: config.password,
    database: config.dbName,
    settings: config.settings,
  })

  if (!conn.host) {
    throw new Error('Host is required. Provide via --dsn, --host, or CH_MIGRATIONS_HOST/CH_MIGRATIONS_DSN')
  }

  const host = conn.host
  const username = conn.username // Optional: uses ClickHouse server defaults if not provided
  const password = conn.password // Optional: uses ClickHouse server defaults if not provided
  const database = conn.database // Optional: server defaults to 'default' database

  const migrations = await getMigrations(config.migrationsHome)

  const client = await connect({
    host,
    username,
    password,
    dbName: database,
    timeout: config.timeout,
    caCert: config.caCert,
    cert: config.cert,
    key: config.key,
  })

  // Verify connection before proceeding
  try {
    await client.ping()
  } catch (e: unknown) {
    await client.close()
    throw new Error(`Failed to connect to ClickHouse at ${host}: ${sanitizeErrorMessage(getErrorMessage(e))}`)
  }

  // Check if migrations table exists
  let migrationsApplied: Map<number, MigrationsRowData>
  try {
    await initMigrationTable(client, config.tableEngine || DEFAULT_TABLE_ENGINE)
    migrationsApplied = await getAppliedMigrations(client)
  } catch (e: unknown) {
    await client.close()
    throw new Error(`Failed to access migrations table: ${sanitizeErrorMessage(getErrorMessage(e))}`)
  }

  await client.close()

  // Build status array by combining migrations from filesystem and database
  const statusList: MigrationStatus[] = []

  // Validate the migrations directory path for security (defence in depth)
  const validatedPath = validateMigrationsHome(config.migrationsHome)

  for (const migration of migrations) {
    const content = await readFile(`${validatedPath}/${migration.file}`, 'utf-8')
    const checksum = crypto.createHash('md5').update(content).digest('hex')
    const appliedMigration = migrationsApplied.get(migration.version)

    if (appliedMigration) {
      statusList.push({
        version: migration.version,
        file: migration.file,
        applied: true,
        appliedAt: appliedMigration.applied_at,
        checksum: appliedMigration.checksum,
        checksumMatch: appliedMigration.checksum === checksum,
      })
    } else {
      statusList.push({
        version: migration.version,
        file: migration.file,
        applied: false,
      })
    }
  }

  return statusList
}

const displayMigrationStatus = (statusList: MigrationStatus[]): void => {
  const logger = getLogger()
  const appliedCount = statusList.filter((s) => s.applied).length
  const pendingCount = statusList.filter((s) => !s.applied).length
  const divergentCount = statusList.filter((s) => s.applied && s.checksumMatch === false).length

  logger.info(`Migration Status: ${appliedCount} applied, ${pendingCount} pending`)

  if (divergentCount > 0) {
    logger.warn(`${divergentCount} applied migration(s) have checksum mismatches`)
  }

  logger.log('')

  for (const status of statusList) {
    if (status.applied) {
      const statusSymbol = status.checksumMatch === false ? `${COLORS.YELLOW}⚠ ` : `${COLORS.GREEN}✓ `
      const checksumWarning = status.checksumMatch === false ? `${COLORS.YELLOW} (checksum mismatch)` : ''
      logger.log(
        `${statusSymbol}${COLORS.RESET}[${status.version}] ${status.file} - applied at ${status.appliedAt}${checksumWarning}${COLORS.RESET}`,
      )
    } else {
      logger.log(`${COLORS.CYAN}○${COLORS.RESET} [${status.version}] ${status.file} - pending`)
    }
  }

  logger.log('')
}

export { runMigration, getMigrationStatus, displayMigrationStatus }
