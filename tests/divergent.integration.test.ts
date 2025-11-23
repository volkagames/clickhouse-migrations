import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runMigration } from '../src/migrate'
import { createMockClickHouseClient } from './helpers/mockClickHouseClient'
import { cleanupTest, setupConsoleSpy, setupIntegrationTest } from './helpers/testSetup'

const { mockClient, mockQuery, mockExec, mockInsert, mockClose, mockPing } = createMockClickHouseClient()

vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => mockClient),
}))

describe('Divergent migration tests with abort_divergent flag', () => {
  let consoleSpy: ReturnType<typeof setupConsoleSpy>

  beforeEach(() => {
    setupIntegrationTest({
      mockQuery,
      mockExec,
      mockInsert,
      mockClose,
      mockClient: undefined,
      mockPing: undefined,
    })
    consoleSpy = setupConsoleSpy()

    // Additional mock for ping
    mockPing.mockResolvedValue()
  })

  afterEach(() => {
    consoleSpy.restore()
    cleanupTest()
  })

  it('Should fail with abort_divergent=true when migration checksum differs', async () => {
    // Mock query to return an applied migration with different checksum
    mockQuery.mockResolvedValueOnce({
      json: () => Promise.resolve([{ version: 1, checksum: 'old_checksum_value', migration_name: '1_init.sql' }]),
    })

    await expect(
      runMigration({
        migrationsHome: 'tests/migrations/one',
        host: 'http://sometesthost:8123',
        username: 'default',
        password: '',
        dbName: 'analytics',
        abortDivergent: true,
        createDatabase: true,
      }),
    ).rejects.toThrow(
      "Migration file shouldn't be changed after apply. Please restore content of the 1_init.sql migration.",
    )
  })

  it('Should continue with warning when abort_divergent=false and checksum differs', async () => {
    // Mock query to return an applied migration with different checksum
    mockQuery.mockResolvedValueOnce({
      json: () => Promise.resolve([{ version: 1, checksum: 'old_checksum_value', migration_name: '1_init.sql' }]),
    })

    await runMigration({
      migrationsHome: 'tests/migrations/one',
      host: 'http://sometesthost:8123',
      username: 'default',
      password: '',
      dbName: 'analytics',
      abortDivergent: false,
      createDatabase: true,
    })

    // Should log warning message
    expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(
      '\x1b[33m',
      '  Warning: applied migration 1_init.sql has different checksum than the file on filesystem. Continuing due to --abort-divergent=false.',
      '\x1b[0m',
    )

    // Should also log success message for no new migrations
    expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(
      '\x1b[36m',
      'clickhouse-migrations :',
      '\x1b[0m',
      'No migrations to apply.',
    )
  })
})
