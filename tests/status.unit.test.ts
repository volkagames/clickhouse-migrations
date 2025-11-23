import * as fs from 'node:fs/promises'
import * as clickhouse from '@clickhouse/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMigrationStatus } from '../src/migrate'
import type { MigrationStatusConfig } from '../src/types/cli'
import { createMockClickHouseClient } from './helpers/mockClickHouseClient'
import { MIGRATION_WITH_TLS_TIMEOUT } from './helpers/testConstants'
import { calculateChecksum, cleanupTest } from './helpers/testSetup'

/**
 * Status Unit Tests
 *
 * Tests for getMigrationStatus function
 */

// Mock modules
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}))

const { mockClient, mockQuery, mockClose } = createMockClickHouseClient()

vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => mockClient),
}))

const mockReaddir = fs.readdir as unknown as ReturnType<typeof vi.fn>
const mockReadFile = fs.readFile as unknown as ReturnType<typeof vi.fn>
const mockCreateClient = clickhouse.createClient as unknown as ReturnType<typeof vi.fn>

describe('getMigrationStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock implementations to defaults
    mockQuery.mockResolvedValue({
      json: vi.fn().mockResolvedValue([]),
    })
    mockClose.mockResolvedValue(undefined)
    mockCreateClient.mockReturnValue(mockClient)
  })

  afterEach(() => {
    cleanupTest()
  })

  const createConfig = (overrides?: Partial<MigrationStatusConfig>): MigrationStatusConfig => ({
    host: 'http://localhost:8123',
    username: 'default',
    password: '',
    dbName: 'test_db',
    migrationsHome: './migrations',
    ...overrides,
  })

  it('should return pending status for unapplied migrations', async () => {
    // Mock filesystem
    mockReaddir.mockResolvedValue(['1_init.sql', '2_add_table.sql'])
    mockReadFile.mockResolvedValue('CREATE TABLE test (id Int32);')

    // Mock empty migrations table
    mockClient.query.mockResolvedValue({
      json: vi.fn().mockResolvedValue([]),
    })

    const config = createConfig()
    const result = await getMigrationStatus(config)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      version: 1,
      file: '1_init.sql',
      applied: false,
    })
    expect(result[1]).toMatchObject({
      version: 2,
      file: '2_add_table.sql',
      applied: false,
    })
    expect(mockClient.close).toHaveBeenCalled()
  })

  it('should return applied status for migrations in database', async () => {
    // Mock filesystem
    mockReaddir.mockResolvedValue(['1_init.sql'])
    const migrationContent = 'CREATE TABLE test (id Int32);'
    mockReadFile.mockResolvedValue(migrationContent)

    // Calculate expected checksum (same as in migrate.ts)
    const expectedChecksum = calculateChecksum(migrationContent)

    // Mock migrations table with applied migration
    mockClient.query.mockResolvedValue({
      json: vi.fn().mockResolvedValue([
        {
          version: 1,
          checksum: expectedChecksum,
          migration_name: '1_init.sql',
          applied_at: '2025-01-20 10:30:45',
        },
      ]),
    })

    const config = createConfig()
    const result = await getMigrationStatus(config)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      version: 1,
      file: '1_init.sql',
      applied: true,
      appliedAt: '2025-01-20 10:30:45',
      checksum: expectedChecksum,
      checksumMatch: true,
    })
    expect(mockClient.close).toHaveBeenCalled()
  })

  it('should detect checksum mismatch for modified migrations', async () => {
    // Mock filesystem
    mockReaddir.mockResolvedValue(['1_init.sql'])
    const currentContent = 'CREATE TABLE test_modified (id Int32);'
    mockReadFile.mockResolvedValue(currentContent)

    const oldChecksum = 'different_checksum_123'

    // Mock migrations table with different checksum
    mockClient.query.mockResolvedValue({
      json: vi.fn().mockResolvedValue([
        {
          version: 1,
          checksum: oldChecksum,
          migration_name: '1_init.sql',
          applied_at: '2025-01-20 10:30:45',
        },
      ]),
    })

    const config = createConfig()
    const result = await getMigrationStatus(config)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      version: 1,
      file: '1_init.sql',
      applied: true,
      checksumMatch: false,
      checksum: oldChecksum,
    })
    expect(result[0]?.checksumMatch).toBe(false)
    expect(mockClient.close).toHaveBeenCalled()
  })

  it('should handle mixed applied and pending migrations', async () => {
    // Mock filesystem
    mockReaddir.mockResolvedValue(['1_init.sql', '2_add_table.sql', '3_add_index.sql'])
    const migrationContent = 'CREATE TABLE test (id Int32);'
    mockReadFile.mockResolvedValue(migrationContent)

    const expectedChecksum = calculateChecksum(migrationContent)

    // Mock migrations table with only first two migrations applied
    mockClient.query.mockResolvedValue({
      json: vi.fn().mockResolvedValue([
        {
          version: 1,
          checksum: expectedChecksum,
          migration_name: '1_init.sql',
          applied_at: '2025-01-20 10:30:45',
        },
        {
          version: 2,
          checksum: expectedChecksum,
          migration_name: '2_add_table.sql',
          applied_at: '2025-01-20 10:30:46',
        },
      ]),
    })

    const config = createConfig()
    const result = await getMigrationStatus(config)

    expect(result).toHaveLength(3)

    // First two should be applied
    expect(result[0]?.applied).toBe(true)
    expect(result[1]?.applied).toBe(true)

    // Third should be pending
    expect(result[2]?.applied).toBe(false)
    expect(mockClient.close).toHaveBeenCalled()
  })

  it('should throw error if migrations directory does not exist', async () => {
    // Mock filesystem error
    mockReaddir.mockRejectedValue(new Error('ENOENT: no such file or directory'))

    const config = createConfig()

    await expect(getMigrationStatus(config)).rejects.toThrow('No migration directory')
  })

  it('should throw error if database connection fails', async () => {
    // Mock filesystem
    mockReaddir.mockResolvedValue(['1_init.sql'])
    mockReadFile.mockResolvedValue('CREATE TABLE test (id Int32);')

    // Mock connection error
    mockClient.query.mockRejectedValue(new Error('Connection refused'))

    const config = createConfig()

    await expect(getMigrationStatus(config)).rejects.toThrow('Failed to access migrations table')
    expect(mockClient.close).toHaveBeenCalled()
  })

  it('should sort migrations by version number', async () => {
    // Mock filesystem with unsorted migrations
    mockReaddir.mockResolvedValue(['10_migration.sql', '1_init.sql', '5_middle.sql', '2_second.sql'])
    mockReadFile.mockResolvedValue('CREATE TABLE test (id Int32);')

    // Mock empty migrations table
    mockClient.query.mockResolvedValue({
      json: vi.fn().mockResolvedValue([]),
    })

    const config = createConfig()
    const result = await getMigrationStatus(config)

    expect(result).toHaveLength(4)
    expect(result[0]?.version).toBe(1)
    expect(result[1]?.version).toBe(2)
    expect(result[2]?.version).toBe(5)
    expect(result[3]?.version).toBe(10)
  })

  it('should handle migrations with leading zeros', async () => {
    // Mock filesystem with migrations having leading zeros
    mockReaddir.mockResolvedValue(['001_init.sql', '002_add_table.sql'])
    mockReadFile.mockResolvedValue('CREATE TABLE test (id Int32);')

    mockClient.query.mockResolvedValue({
      json: vi.fn().mockResolvedValue([]),
    })

    const config = createConfig()
    const result = await getMigrationStatus(config)

    expect(result).toHaveLength(2)
    expect(result[0]?.version).toBe(1)
    expect(result[1]?.version).toBe(2)
  })

  it('should connect to database with correct credentials', async () => {
    // Mock filesystem
    mockReaddir.mockResolvedValue(['1_init.sql'])
    mockReadFile.mockResolvedValue('CREATE TABLE test (id Int32);')

    mockClient.query.mockResolvedValue({
      json: vi.fn().mockResolvedValue([]),
    })

    const config = createConfig({
      host: 'http://custom-host:8123',
      username: 'test_user',
      password: 'test_password',
      dbName: 'custom_db',
    })

    await getMigrationStatus(config)

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://custom-host:8123',
        username: 'test_user',
        password: 'test_password',
        database: 'custom_db',
      }),
    )
  })

  it('should handle timeout configuration', async () => {
    // Mock filesystem
    mockReaddir.mockResolvedValue(['1_init.sql'])
    mockReadFile.mockResolvedValue('CREATE TABLE test (id Int32);')

    mockClient.query.mockResolvedValue({
      json: vi.fn().mockResolvedValue([]),
    })

    const config = createConfig({
      timeout: MIGRATION_WITH_TLS_TIMEOUT,
    })

    await getMigrationStatus(config)

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({
        request_timeout: MIGRATION_WITH_TLS_TIMEOUT,
      }),
    )
  })
})
