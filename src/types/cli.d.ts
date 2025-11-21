/// <reference types="node" />

export type MigrationBase = {
  version: number;
  file: string;
};

export type MigrationsRowData = {
  version: number;
  checksum: string;
  migration_name: string;
};

export type CliParameters = {
  migrationsHome: string;
  host: string;
  user: string;
  password: string;
  db: string;
  dbEngine?: string;
  tableEngine?: string;
  timeout?: string;
  caCert?: string;
  cert?: string;
  key?: string;
  abortDivergent?: boolean | string;
  createDatabase?: boolean | string;
};

export type QueryError = {
  message: string;
};
