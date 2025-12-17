import * as crypto from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import type { ClickHouseClient } from '@clickhouse/client'
import type { ILogger } from './logger'
import { sqlQueries, sqlSets } from './sql-parse'
import type { MigrationBase, MigrationRecord } from './types'
import { getErrorMessage, VALIDATION_PATTERNS, validateMigrationsHome } from './validation'

const MIGRATIONS_TABLE = '_migrations'

/**
 * Reads migration files from the specified directory.
 *
 * @param migrationsHome - Path to migrations directory
 * @returns Sorted array of migrations with version and filename
 * @throws Error if directory doesn't exist, is empty, or contains invalid files
 */
export const getMigrations = async (migrationsHome: string): Promise<MigrationBase[]> => {
  const validatedPath = validateMigrationsHome(migrationsHome)

  let files: string[]
  try {
    files = await readdir(validatedPath)
  } catch {
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

    migrations.push({ version, file })
  }

  if (migrations.length === 0) {
    throw new Error(`No migrations in the ${validatedPath} migrations directory`)
  }

  migrations.sort((m1, m2) => m1.version - m2.version)

  // Check for duplicate versions
  for (let i = 1; i < migrations.length; i++) {
    const current = migrations[i]
    const previous = migrations[i - 1]
    if (current && previous && current.version === previous.version) {
      throw new Error(`Found duplicate migration version ${current.version}: ${previous.file}, ${current.file}`)
    }
  }

  return migrations
}

/**
 * Fetches applied migrations from database.
 *
 * @param client - Connected ClickHouse client
 * @param tableName - Name of migrations tracking table
 * @returns Map of version to migration record
 * @throws Error if query fails
 */
export const getAppliedMigrations = async (
  client: ClickHouseClient,
  tableName: string = MIGRATIONS_TABLE,
): Promise<Map<number, MigrationRecord>> => {
  let records: MigrationRecord[]
  try {
    const resultSet = await client.query({
      query: `SELECT version, checksum, migration_name, applied_at FROM ${tableName} ORDER BY version`,
      format: 'JSONEachRow',
    })
    records = await resultSet.json()
  } catch (e: unknown) {
    throw new Error(`Can't select data from the ${tableName} table: ${getErrorMessage(e)}`)
  }

  const migrationsMap = new Map<number, MigrationRecord>()
  for (const row of records) {
    migrationsMap.set(row.version, {
      version: row.version,
      checksum: row.checksum,
      migration_name: row.migration_name,
      applied_at: row.applied_at,
    })
  }

  return migrationsMap
}

/**
 * Validates that all applied migrations still exist on filesystem.
 *
 * @param appliedMigrations - Map of applied migrations from database
 * @param migrations - Array of migrations from filesystem
 * @throws Error if any applied migration file is missing
 */
export const validateAppliedMigrations = (
  appliedMigrations: Map<number, MigrationRecord>,
  migrations: MigrationBase[],
): void => {
  for (const [version, appliedMigration] of appliedMigrations) {
    const migrationExists = migrations.some((m) => m.version === version)
    if (!migrationExists) {
      throw new Error(
        `Migration file shouldn't be removed after apply. Please restore the migration ${appliedMigration.migration_name}.`,
      )
    }
  }
}

/**
 * Executes SQL queries from a migration file.
 *
 * @param client - Connected ClickHouse client
 * @param queries - Array of SQL queries to execute
 * @param settings - ClickHouse settings for the queries
 * @param migrationFile - Filename for error messages
 * @throws Error if any query fails
 */
export const executeMigrationQueries = async (
  client: ClickHouseClient,
  queries: string[],
  settings: Record<string, string>,
  migrationFile: string,
): Promise<void> => {
  for (const query of queries) {
    try {
      await client.exec({
        query,
        clickhouse_settings: settings,
      })
    } catch (e: unknown) {
      throw new Error(
        `the migrations ${migrationFile} has an error. Please, fix it (be sure that already executed parts of the migration would not be run second time) and re-run migration script.\n\n${getErrorMessage(e)}`,
      )
    }
  }
}

/**
 * Records a successfully applied migration in the tracking table.
 *
 * @param client - Connected ClickHouse client
 * @param migration - Migration that was applied
 * @param checksum - MD5 checksum of migration content
 * @param tableName - Name of migrations tracking table
 * @throws Error if insert fails
 */
export const recordMigration = async (
  client: ClickHouseClient,
  migration: MigrationBase,
  checksum: string,
  tableName: string = MIGRATIONS_TABLE,
): Promise<void> => {
  try {
    await client.insert({
      table: tableName,
      values: [
        {
          version: migration.version,
          checksum,
          migration_name: migration.file,
        },
      ],
      format: 'JSONEachRow',
    })
  } catch (e: unknown) {
    throw new Error(`Can't insert data into the ${tableName} table: ${getErrorMessage(e)}`)
  }
}

/**
 * Computes MD5 checksum of migration file content.
 */
export const computeChecksum = (content: string): string => {
  return crypto.createHash('md5').update(content).digest('hex')
}

/**
 * Applies pending migrations to the database.
 *
 * @param client - Connected ClickHouse client
 * @param migrations - Array of all migrations from filesystem
 * @param migrationsHome - Path to migrations directory
 * @param logger - Logger instance
 * @param abortDivergent - Whether to abort on checksum mismatch
 * @param globalSettings - Global ClickHouse settings to apply
 * @param tableName - Name of migrations tracking table
 * @throws Error if any migration fails
 */
export const applyMigrations = async (
  client: ClickHouseClient,
  migrations: MigrationBase[],
  migrationsHome: string,
  logger: ILogger,
  abortDivergent = true,
  globalSettings: Record<string, string> = {},
  tableName: string = MIGRATIONS_TABLE,
): Promise<void> => {
  const validatedPath = validateMigrationsHome(migrationsHome)
  const appliedMigrations = await getAppliedMigrations(client, tableName)

  validateAppliedMigrations(appliedMigrations, migrations)

  const appliedList: string[] = []

  for (const migration of migrations) {
    const content = await readFile(`${validatedPath}/${migration.file}`, 'utf-8')
    const checksum = computeChecksum(content)
    const applied = appliedMigrations.get(migration.version)

    if (applied) {
      // Check for divergent migration (content changed after apply)
      if (applied.checksum !== checksum) {
        if (abortDivergent) {
          throw new Error(
            `Migration file shouldn't be changed after apply. Please restore content of the ${applied.migration_name} migration.`,
          )
        }
        logger.warn(
          `applied migration ${applied.migration_name} has different checksum than the file on filesystem. Continuing due to --abort-divergent=false.`,
        )
      }
      logger.debug(`Skipped: ${migration.file} (already applied)`)
      continue
    }

    const queries = sqlQueries(content)
    const sets = sqlSets(content)
    const mergedSettings = { ...globalSettings, ...sets }

    try {
      await executeMigrationQueries(client, queries, mergedSettings, migration.file)
    } catch (e: unknown) {
      if (appliedList.length > 0) {
        logger.info(`The migration(s) ${appliedList.join(', ')} was successfully applied!`)
      }
      throw e
    }

    await recordMigration(client, migration, checksum, tableName)
    appliedList.push(migration.file)
    logger.info(`Applied: ${migration.file}`)
  }

  if (appliedList.length > 0) {
    logger.info(`${appliedList.length} migration(s) successfully applied`)
  } else {
    logger.info('No migrations to apply.')
  }
}
