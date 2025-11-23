import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runMigration } from '../src/migrate'
import { createMockClickHouseClient } from './helpers/mockClickHouseClient'
import { cleanupTest, setupIntegrationTest } from './helpers/testSetup'

const { mockClient, mockQuery, mockExec, mockInsert, mockClose } = createMockClickHouseClient()

vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => mockClient),
}))

describe('Migration tests', () => {
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

  it('First migration', async () => {
    const querySpy = vi.spyOn(mockClient, 'query')
    const execSpy = vi.spyOn(mockClient, 'exec')
    const insertSpy = vi.spyOn(mockClient, 'insert')

    await runMigration({
      migrationsHome: 'tests/migrations/one',
      host: 'http://sometesthost:8123',
      username: 'default',
      password: '',
      dbName: 'analytics',
      abortDivergent: true,
      createDatabase: true,
    })

    expect(execSpy).toHaveBeenCalledTimes(3)
    expect(querySpy).toHaveBeenCalledTimes(1)
    expect(insertSpy).toHaveBeenCalledTimes(1)

    expect(execSpy).toHaveBeenNthCalledWith(1, {
      query: 'CREATE DATABASE IF NOT EXISTS {name:Identifier}',
      query_params: {
        name: 'analytics',
      },
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    })
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
    expect(execSpy).toHaveBeenNthCalledWith(3, {
      clickhouse_settings: { allow_experimental_json_type: '1' },
      query:
        'CREATE TABLE IF NOT EXISTS `events` ( `event_id` UInt64, `event_data` JSON ) ENGINE=MergeTree() ORDER BY (`event_id`) SETTINGS index_granularity = 8192',
    })

    expect(querySpy).toHaveBeenNthCalledWith(1, {
      format: 'JSONEachRow',
      query: 'SELECT version, checksum, migration_name, applied_at FROM _migrations ORDER BY version',
    })

    expect(insertSpy).toHaveBeenNthCalledWith(1, {
      format: 'JSONEachRow',
      table: '_migrations',
      values: [{ checksum: '2f66edf1a8c3fa2e29835ad9ac8140a7', migration_name: '1_init.sql', version: 1 }],
    })
  })
})
