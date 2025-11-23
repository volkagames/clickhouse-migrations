import { describe, expect, it } from 'vitest'
import { getMigrationStatus, runMigration } from '../src/migrate'
import { MIGRATION_TIMEOUT } from './helpers/testConstants'

describe('Connection Error Handling', () => {
  describe('runMigration', () => {
    it('should throw error when host is unreachable', async () => {
      await expect(
        runMigration({
          host: 'http://non-existent-host-12345.invalid:8123',
          migrationsHome: './tests/migrations/one',
          timeout: MIGRATION_TIMEOUT,
          createDatabase: false,
        }),
      ).rejects.toThrow(/getaddrinfo|ENOTFOUND|EAI_AGAIN|network|connection/i)
    })

    it('should throw error with wrong port', async () => {
      await expect(
        runMigration({
          host: 'http://localhost:9999',
          migrationsHome: './tests/migrations/one',
          timeout: MIGRATION_TIMEOUT,
          createDatabase: false,
        }),
      ).rejects.toThrow(/ECONNREFUSED|connection refused|connect/i)
    })

    it('should throw error when DSN host is unreachable', async () => {
      await expect(
        runMigration({
          dsn: 'clickhouse://user:pass@non-existent-host-12345.invalid:8123/db',
          migrationsHome: './tests/migrations/one',
          timeout: MIGRATION_TIMEOUT,
          createDatabase: false,
        }),
      ).rejects.toThrow(/getaddrinfo|ENOTFOUND|EAI_AGAIN|network|connection/i)
    })

    it('should throw error with invalid credentials', async () => {
      await expect(
        runMigration({
          host: 'http://localhost:8123',
          username: 'invalid_user',
          password: 'invalid_password',
          migrationsHome: './tests/migrations/one',
          timeout: MIGRATION_TIMEOUT,
          createDatabase: false,
        }),
      ).rejects.toThrow(/authentication|auth|credentials|unauthorized|403/i)
    })
  })

  describe('getMigrationStatus', () => {
    it('should throw error when host is unreachable', async () => {
      await expect(
        getMigrationStatus({
          host: 'http://non-existent-host-12345.invalid:8123',
          migrationsHome: './tests/migrations/one',
          timeout: MIGRATION_TIMEOUT,
        }),
      ).rejects.toThrow(/getaddrinfo|ENOTFOUND|EAI_AGAIN|network|connection/i)
    })

    it('should throw error with wrong port', async () => {
      await expect(
        getMigrationStatus({
          host: 'http://localhost:9999',
          migrationsHome: './tests/migrations/one',
          timeout: MIGRATION_TIMEOUT,
        }),
      ).rejects.toThrow(/ECONNREFUSED|connection refused|connect/i)
    })

    it('should throw error when DSN host is unreachable', async () => {
      await expect(
        getMigrationStatus({
          dsn: 'clickhouse://user:pass@non-existent-host-12345.invalid:8123/db',
          migrationsHome: './tests/migrations/one',
          timeout: MIGRATION_TIMEOUT,
        }),
      ).rejects.toThrow(/getaddrinfo|ENOTFOUND|EAI_AGAIN|network|connection/i)
    })

    it('should throw error with invalid credentials', async () => {
      await expect(
        getMigrationStatus({
          host: 'http://localhost:8123',
          username: 'invalid_user',
          password: 'invalid_password',
          migrationsHome: './tests/migrations/one',
          timeout: MIGRATION_TIMEOUT,
        }),
      ).rejects.toThrow(/authentication|auth|credentials|unauthorized|403/i)
    })
  })
})
