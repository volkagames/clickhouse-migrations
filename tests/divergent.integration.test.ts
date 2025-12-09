import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createLogger } from '../src/logger'
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

    const logger = createLogger()
    await expect(
      runMigration({
        migrationsHome: 'tests/migrations/one',
        host: 'http://sometesthost:8123',
        username: 'default',
        password: '',
        dbName: 'analytics',
        dbEngine: 'ENGINE=Atomic',
        tableEngine: 'MergeTree',
        abortDivergent: true,
        createDatabase: true,
        logger,
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

    const logger = createLogger({ base: {} })
    await runMigration({
      migrationsHome: 'tests/migrations/one',
      host: 'http://sometesthost:8123',
      username: 'default',
      password: '',
      dbName: 'analytics',
      dbEngine: 'ENGINE=Atomic',
      tableEngine: 'MergeTree',
      abortDivergent: false,
      createDatabase: true,
      logger,
    })

    // Should log warning message (JSON format)
    const warnCall = consoleSpy.consoleLogSpy.mock.calls.find((call: string[]) => {
      const output = call[0]
      if (typeof output !== 'string') {
        return false
      }
      try {
        const parsed = JSON.parse(output)
        return parsed.level === 40 && parsed.msg?.includes('different checksum') && parsed.msg?.includes('1_init.sql')
      } catch {
        return false
      }
    })
    expect(warnCall).toBeDefined()

    // Should also log success message for no new migrations (JSON format)
    const infoCall = consoleSpy.consoleLogSpy.mock.calls.find((call: string[]) => {
      const output = call[0]
      if (typeof output !== 'string') {
        return false
      }
      try {
        const parsed = JSON.parse(output)
        return parsed.level === 30 && parsed.msg === 'No migrations to apply.'
      } catch {
        return false
      }
    })
    expect(infoCall).toBeDefined()
  })
})
