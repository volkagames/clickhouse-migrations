import { readFile } from 'node:fs/promises'

import {
  connect,
  createDb,
  DEFAULT_DB_ENGINE,
  DEFAULT_TABLE_ENGINE,
  initMigrationTable,
  MIGRATIONS_TABLE,
  verifyConnection,
} from './connection'
import { setupConnectionConfig } from './dsn-parser'
import { applyMigrations, computeChecksum, getAppliedMigrations, getMigrations } from './executor'
import { COLORS, type ILogger } from './logger'
import type { MigrationRunConfig, MigrationStatus, MigrationStatusConfig } from './types'
import { getErrorMessage, sanitizeErrorMessage, validateMigrationsHome } from './validation'

// Re-export for public API
export { createLogger, type ILogger as Logger, type Level, type LoggerOptions } from './logger'
// Legacy type exports for backward compatibility
export type {
  ConnectionConfig,
  MigrationBase,
  MigrationRecord,
  MigrationRecord as MigrationsRowData,
  MigrationRunConfig,
  MigrationStatus,
  MigrationStatusConfig,
  QueryError,
  TlsConfig,
} from './types'
export { sanitizeErrorMessage } from './validation'

/**
 * Runs pending migrations against a ClickHouse database.
 *
 * @param config - Migration run configuration
 * @throws Error if connection fails or migration execution fails
 *
 * @example
 * ```ts
 * import { runMigration, createLogger } from '@volkagames/clickhouse-migrations'
 *
 * await runMigration({
 *   migrationsHome: './migrations',
 *   host: 'http://localhost:8123',
 *   dbName: 'mydb',
 *   logger: createLogger({ format: 'json' }),
 * })
 * ```
 */
export const runMigration = async (config: MigrationRunConfig): Promise<void> => {
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

  const { host, username, password, database } = conn
  const migrations = await getMigrations(config.migrationsHome)

  if (config.createDatabase !== false) {
    await createDb({
      host,
      username,
      password,
      dbName: database,
      dbEngine: config.dbEngine ?? DEFAULT_DB_ENGINE,
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

  await verifyConnection(client, host)

  const migrationTableName = config.migrationTableName || MIGRATIONS_TABLE

  try {
    await initMigrationTable(client, config.tableEngine || DEFAULT_TABLE_ENGINE, migrationTableName)

    const settings = { ...conn.settings, ...(config.settings || {}) }

    await applyMigrations(
      client,
      migrations,
      config.migrationsHome,
      config.logger,
      config.abortDivergent ?? true,
      settings,
      migrationTableName,
    )
  } catch (e: unknown) {
    await client.close()
    throw e
  }

  await client.close()
}

/**
 * Gets the status of all migrations (applied vs pending).
 *
 * @param config - Migration status configuration
 * @returns Array of migration statuses
 * @throws Error if connection fails
 *
 * @example
 * ```ts
 * import { getMigrationStatus, displayMigrationStatus, createLogger } from '@volkagames/clickhouse-migrations'
 *
 * const logger = createLogger()
 * const status = await getMigrationStatus({
 *   migrationsHome: './migrations',
 *   host: 'http://localhost:8123',
 *   dbName: 'mydb',
 *   logger,
 * })
 * displayMigrationStatus(status, logger)
 * ```
 */
export const getMigrationStatus = async (config: MigrationStatusConfig): Promise<MigrationStatus[]> => {
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

  const { host, username, password, database } = conn
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

  await verifyConnection(client, host)

  const migrationTableName = config.migrationTableName || MIGRATIONS_TABLE

  let appliedMigrations: Map<number, { version: number; checksum: string; migration_name: string; applied_at?: string }>
  try {
    await initMigrationTable(client, config.tableEngine || DEFAULT_TABLE_ENGINE, migrationTableName)
    appliedMigrations = await getAppliedMigrations(client, migrationTableName)
  } catch (e: unknown) {
    await client.close()
    throw new Error(`Failed to access migrations table: ${sanitizeErrorMessage(getErrorMessage(e))}`)
  }

  await client.close()

  const validatedPath = validateMigrationsHome(config.migrationsHome)
  const statusList: MigrationStatus[] = []

  for (const migration of migrations) {
    const content = await readFile(`${validatedPath}/${migration.file}`, 'utf-8')
    const checksum = computeChecksum(content)
    const applied = appliedMigrations.get(migration.version)

    if (applied) {
      statusList.push({
        version: migration.version,
        file: migration.file,
        applied: true,
        appliedAt: applied.applied_at,
        checksum: applied.checksum,
        checksumMatch: applied.checksum === checksum,
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

/**
 * Displays migration status in a formatted output.
 *
 * @param statusList - Array of migration statuses
 * @param logger - Logger instance
 */
export const displayMigrationStatus = (statusList: MigrationStatus[], logger: ILogger): void => {
  const appliedCount = statusList.filter((s) => s.applied).length
  const pendingCount = statusList.filter((s) => !s.applied).length
  const divergentCount = statusList.filter((s) => s.applied && s.checksumMatch === false).length

  logger.info(`Migration Status: ${appliedCount} applied, ${pendingCount} pending`)

  if (divergentCount > 0) {
    logger.warn(`${divergentCount} applied migration(s) have checksum mismatches`)
  }

  logger.info('')

  for (const status of statusList) {
    if (status.applied) {
      const statusSymbol = status.checksumMatch === false ? `${COLORS.YELLOW}⚠ ` : `${COLORS.GREEN}✓ `
      const checksumWarning = status.checksumMatch === false ? `${COLORS.YELLOW} (checksum mismatch)` : ''
      logger.info(
        `${statusSymbol}${COLORS.RESET}[${status.version}] ${status.file} - applied at ${status.appliedAt}${checksumWarning}${COLORS.RESET}`,
      )
    } else {
      logger.info(`${COLORS.CYAN}○${COLORS.RESET} [${status.version}] ${status.file} - pending`)
    }
  }

  logger.info('')
}
