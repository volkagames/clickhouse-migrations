import type { ILogger } from './logger'

/** Base migration file information */
export interface MigrationBase {
  version: number
  file: string
}

/** Migration record stored in the database */
export interface MigrationRecord {
  version: number
  checksum: string
  migration_name: string
  applied_at?: string
}

/** Migration status combining filesystem and database state */
export interface MigrationStatus {
  version: number
  file: string
  applied: boolean
  appliedAt?: string
  checksum?: string
  checksumMatch?: boolean
}

/** Error type for query execution errors */
export interface QueryError {
  message: string
}

/** TLS configuration for secure connections */
export interface TlsConfig {
  caCert?: string
  cert?: string
  key?: string
}

/** Base connection configuration */
export interface ConnectionConfig extends TlsConfig {
  host?: string
  username?: string
  password?: string
  dbName?: string
  timeout?: string | number
}

/** Configuration for database creation */
export interface CreateDbConfig extends Omit<ConnectionConfig, 'host'> {
  host: string
  dbName?: string
  dbEngine?: string
}

/** Configuration for running migrations */
export interface MigrationRunConfig extends ConnectionConfig {
  migrationsHome: string
  dsn?: string
  dbName?: string
  dbEngine?: string
  tableEngine?: string
  migrationTableName?: string
  abortDivergent?: boolean
  createDatabase?: boolean
  settings?: Record<string, string>
  logger: ILogger
}

/** Configuration for getting migration status */
export interface MigrationStatusConfig extends ConnectionConfig {
  migrationsHome: string
  dsn?: string
  dbName?: string
  tableEngine?: string
  migrationTableName?: string
  settings?: Record<string, string>
  logger: ILogger
}

/** Validated connection with required host */
export interface ValidatedConnection {
  host: string
  username?: string
  password?: string
  database?: string
  settings?: Record<string, string>
}
