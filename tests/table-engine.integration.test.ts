import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createLogger } from '../src/logger'
import { runMigration } from '../src/migrate'
import { createMockClickHouseClient } from './helpers/mockClickHouseClient'
import { cleanupTest, setupIntegrationTest } from './helpers/testSetup'

const { mockClient, mockQuery, mockExec, mockInsert, mockClose } = createMockClickHouseClient()

vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => mockClient),
}))

describe('Table engine configuration tests', () => {
  beforeEach(() => {
    setupIntegrationTest({
      mockQuery,
      mockExec,
      mockInsert,
      mockClose,
      mockClient: undefined,
      mockPing: undefined,
    })
  })

  afterEach(() => {
    cleanupTest()
  })

  it('Should create _migrations table with default ReplicatedMergeTree engine', async () => {
    const execSpy = vi.spyOn(mockClient, 'exec')

    const logger = createLogger()
    await runMigration({
      migrationsHome: 'tests/migrations/one',
      host: 'http://sometesthost:8123',
      username: 'default',
      password: '',
      dbName: 'analytics',
      abortDivergent: true,
      createDatabase: true,
      logger,
    })

    // Check that _migrations table was created with default ReplicatedMergeTree engine
    expect(execSpy).toHaveBeenNthCalledWith(2, {
      query: `CREATE TABLE IF NOT EXISTS _migrations (
      uid UUID DEFAULT generateUUIDv4(),
      version UInt32,
      checksum String,
      migration_name String,
      applied_at DateTime DEFAULT now()
    )
    ENGINE = ReplicatedMergeTree
    ORDER BY tuple(applied_at)`,
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    })
  })

  it('Should create _migrations table with standalone MergeTree engine', async () => {
    const execSpy = vi.spyOn(mockClient, 'exec')

    const logger = createLogger()
    await runMigration({
      migrationsHome: 'tests/migrations/one',
      host: 'http://sometesthost:8123',
      username: 'default',
      password: '',
      dbName: 'analytics',
      tableEngine: 'MergeTree',
      abortDivergent: true,
      createDatabase: true,
      logger,
    })

    // Check that _migrations table was created with MergeTree engine
    expect(execSpy).toHaveBeenNthCalledWith(2, {
      query: `CREATE TABLE IF NOT EXISTS _migrations (
      uid UUID DEFAULT generateUUIDv4(),
      version UInt32,
      checksum String,
      migration_name String,
      applied_at DateTime DEFAULT now()
    )
    ENGINE = MergeTree
    ORDER BY tuple(applied_at)`,
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    })
  })

  it('Should create _migrations table with custom ReplicatedMergeTree engine', async () => {
    const execSpy = vi.spyOn(mockClient, 'exec')

    const customEngine = "ReplicatedMergeTree('/clickhouse/tables/{database}/migrations', '{replica}')"

    const logger = createLogger()
    await runMigration({
      migrationsHome: 'tests/migrations/one',
      host: 'http://sometesthost:8123',
      username: 'default',
      password: '',
      dbName: 'analytics',
      tableEngine: customEngine,
      abortDivergent: true,
      createDatabase: true,
      logger,
    })

    // Check that _migrations table was created with custom engine
    expect(execSpy).toHaveBeenNthCalledWith(2, {
      query: `CREATE TABLE IF NOT EXISTS _migrations (
      uid UUID DEFAULT generateUUIDv4(),
      version UInt32,
      checksum String,
      migration_name String,
      applied_at DateTime DEFAULT now()
    )
    ENGINE = ${customEngine}
    ORDER BY tuple(applied_at)`,
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    })
  })

  it('Should create _migrations table with SharedMergeTree engine for cloud', async () => {
    const execSpy = vi.spyOn(mockClient, 'exec')

    const cloudEngine = 'SharedMergeTree'

    const logger = createLogger()
    await runMigration({
      migrationsHome: 'tests/migrations/one',
      host: 'http://sometesthost:8123',
      username: 'default',
      password: '',
      dbName: 'analytics',
      tableEngine: cloudEngine,
      abortDivergent: true,
      createDatabase: true,
      logger,
    })

    // Check that _migrations table was created with SharedMergeTree
    expect(execSpy).toHaveBeenNthCalledWith(2, {
      query: `CREATE TABLE IF NOT EXISTS _migrations (
      uid UUID DEFAULT generateUUIDv4(),
      version UInt32,
      checksum String,
      migration_name String,
      applied_at DateTime DEFAULT now()
    )
    ENGINE = ${cloudEngine}
    ORDER BY tuple(applied_at)`,
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    })
  })

  it('Should create custom named table with custom engine', async () => {
    const execSpy = vi.spyOn(mockClient, 'exec')
    const insertSpy = vi.spyOn(mockClient, 'insert')

    const customTableName = 'my_custom_migrations'
    const customEngine = "ReplicatedMergeTree('/clickhouse/tables/{database}/migrations', '{replica}')"

    const logger = createLogger()
    await runMigration({
      migrationsHome: 'tests/migrations/one',
      host: 'http://sometesthost:8123',
      username: 'default',
      password: '',
      dbName: 'analytics',
      migrationTableName: customTableName,
      tableEngine: customEngine,
      abortDivergent: true,
      createDatabase: true,
      logger,
    })

    // Check that custom named table was created with custom engine
    expect(execSpy).toHaveBeenNthCalledWith(2, {
      query: `CREATE TABLE IF NOT EXISTS ${customTableName} (
      uid UUID DEFAULT generateUUIDv4(),
      version UInt32,
      checksum String,
      migration_name String,
      applied_at DateTime DEFAULT now()
    )
    ENGINE = ${customEngine}
    ORDER BY tuple(applied_at)`,
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    })

    // Verify insert uses custom table name
    expect(insertSpy).toHaveBeenNthCalledWith(1, {
      format: 'JSONEachRow',
      table: customTableName,
      values: [{ checksum: '2f66edf1a8c3fa2e29835ad9ac8140a7', migration_name: '1_init.sql', version: 1 }],
    })
  })
})
