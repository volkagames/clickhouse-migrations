/// <reference types="node" />

export type MigrationBase = {
  version: number
  file: string
}

export type MigrationsRowData = {
  version: number
  checksum: string
  migration_name: string
  applied_at?: string
}

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
}

export type QueryError = {
  message: string
}

export type TlsConfig = {
  caCert?: string
  cert?: string
  key?: string
}

export type ConnectionConfig = {
  host?: string
  username?: string
  password?: string
  dbName?: string
  timeout?: string | number
} & TlsConfig

export type CreateDbConfig = {
  host: string
  dbName?: string
  dbEngine?: string
} & Omit<ConnectionConfig, 'host'>

export type MigrationRunConfig = {
  migrationsHome: string
  dsn?: string
  dbName?: string
  dbEngine?: string
  tableEngine?: string
  abortDivergent?: boolean
  createDatabase?: boolean
  settings?: Record<string, string>
} & ConnectionConfig

export type MigrationStatusConfig = {
  migrationsHome: string
  dsn?: string
  dbName?: string
  tableEngine?: string
  settings?: Record<string, string>
} & ConnectionConfig

export type MigrationStatus = {
  version: number
  file: string
  applied: boolean
  appliedAt?: string
  checksum?: string
  checksumMatch?: boolean
}
