import { readFile } from 'node:fs/promises'
import { type ClickHouseClient, type ClickHouseClientConfigOptions, createClient } from '@clickhouse/client'
import type { ConnectionConfig, CreateDbConfig } from './types'
import {
  getErrorMessage,
  sanitizeErrorMessage,
  validateDbEngine,
  validateDbName,
  validateTableEngine,
  validateTableName,
} from './validation'

const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_DB_ENGINE =
  "ON CLUSTER '{cluster}' ENGINE = Replicated('/clickhouse/{installation}/{cluster}/databases/{database}', '{shard}', '{replica}')"
const DEFAULT_TABLE_ENGINE = 'ReplicatedMergeTree'
const MIGRATIONS_TABLE = '_migrations'

export { DEFAULT_DB_ENGINE, DEFAULT_TABLE_ENGINE, MIGRATIONS_TABLE }

/**
 * Creates a ClickHouse client connection.
 *
 * @param config - Connection configuration with required host
 * @returns Connected ClickHouse client
 * @throws Error if connection parameters are invalid
 */
export const connect = async (config: ConnectionConfig & { host: string }): Promise<ClickHouseClient> => {
  const dbParams: ClickHouseClientConfigOptions = {
    url: config.host,
    application: 'clickhouse-migrations',
  }

  // Certificate authentication takes precedence over password
  const usingCertAuth = config.cert && config.key

  if (config.username) {
    dbParams.username = config.username
  }

  // Only set password if not using certificate authentication
  if (config.password && !usingCertAuth) {
    dbParams.password = config.password
  }

  if (config.dbName) {
    dbParams.database = config.dbName
  }

  const timeoutMs = config.timeout ? Number(config.timeout) : DEFAULT_TIMEOUT_MS
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

/**
 * Verifies database connection by sending a ping request.
 *
 * @param client - ClickHouse client to verify
 * @param host - Host URL for error message
 * @throws Error if connection cannot be established
 */
export const verifyConnection = async (client: ClickHouseClient, host: string): Promise<void> => {
  try {
    await client.ping()
  } catch (e: unknown) {
    await client.close()
    throw new Error(`Failed to connect to ClickHouse at ${host}: ${sanitizeErrorMessage(getErrorMessage(e))}`)
  }
}

/**
 * Creates a database if it doesn't exist.
 *
 * @param config - Database creation configuration
 * @throws Error if database creation fails
 */
export const createDb = async (config: CreateDbConfig): Promise<void> => {
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

  // Validate database name if provided
  if (config.dbName) {
    validateDbName(config.dbName)
  }

  // Validate engine clause if provided
  if (config.dbEngine) {
    validateDbEngine(config.dbEngine)
  }

  // Parameterized query for defense in depth
  const baseQuery = 'CREATE DATABASE IF NOT EXISTS {name:Identifier}'
  const query = config.dbEngine ? `${baseQuery} ${config.dbEngine}` : baseQuery

  try {
    await client.exec({
      query,
      query_params: { name: config.dbName },
      clickhouse_settings: { wait_end_of_query: 1 },
    })
  } catch (e: unknown) {
    await client.close()
    throw new Error(`Can't create the database ${config.dbName}: ${sanitizeErrorMessage(getErrorMessage(e))}`)
  }

  await client.close()
}

/**
 * Initializes the migrations tracking table.
 *
 * @param client - Connected ClickHouse client
 * @param tableEngine - Table engine to use (default: MergeTree)
 * @param tableName - Name for the migrations table (default: _migrations)
 * @throws Error if table creation fails
 */
export const initMigrationTable = async (
  client: ClickHouseClient,
  tableEngine: string = DEFAULT_TABLE_ENGINE,
  tableName: string = MIGRATIONS_TABLE,
): Promise<void> => {
  const validatedTableName = validateTableName(tableName)
  const validatedEngine = validateTableEngine(tableEngine)

  const query = `CREATE TABLE IF NOT EXISTS ${validatedTableName} (
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
      query,
      clickhouse_settings: { wait_end_of_query: 1 },
    })
  } catch (e: unknown) {
    throw new Error(`Can't create the ${validatedTableName} table: ${getErrorMessage(e)}`)
  }
}
