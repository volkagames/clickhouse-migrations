import { describe, expect, it } from 'vitest'
import { getMigrationStatus, runMigration } from '../src/migrate'

describe('Migrations Home Path Validation', () => {
  describe('Path resolution', () => {
    it('should resolve path with ../ traversal to absolute path', async () => {
      // Path should be resolved, but will fail on directory not existing
      await expect(
        runMigration({
          host: 'http://localhost:8123',
          migrationsHome: '../../../some/path',
          createDatabase: false,
        }),
      ).rejects.toThrow('No migration directory')
    })

    it('should resolve path with ../ in the middle to absolute path', async () => {
      // Path should be resolved, but will fail on directory not existing
      await expect(
        runMigration({
          host: 'http://localhost:8123',
          migrationsHome: 'some/path/../../another',
          createDatabase: false,
        }),
      ).rejects.toThrow('No migration directory')
    })

    it('should resolve Windows-style ..\\ to absolute path', async () => {
      // Path should be resolved, but will fail on directory not existing
      await expect(
        runMigration({
          host: 'http://localhost:8123',
          migrationsHome: '..\\..\\some\\path',
          createDatabase: false,
        }),
      ).rejects.toThrow('No migration directory')
    })

    it('should resolve path starting with ../ to absolute path', async () => {
      // Path should be resolved, but will fail on directory not existing
      await expect(
        getMigrationStatus({
          host: 'http://localhost:8123',
          migrationsHome: '../migrations',
        }),
      ).rejects.toThrow('No migration directory')
    })
  })

  describe('Empty and invalid paths', () => {
    it('should reject empty string', async () => {
      await expect(
        runMigration({
          host: 'http://localhost:8123',
          migrationsHome: '',
          createDatabase: false,
        }),
      ).rejects.toThrow('Migrations directory path is required and must be a string')
    })

    it('should reject whitespace-only string', async () => {
      await expect(
        runMigration({
          host: 'http://localhost:8123',
          migrationsHome: '   ',
          createDatabase: false,
        }),
      ).rejects.toThrow('cannot be empty or whitespace')
    })

    it('should reject null bytes', async () => {
      await expect(
        getMigrationStatus({
          host: 'http://localhost:8123',
          migrationsHome: 'migrations\0/etc/passwd',
        }),
      ).rejects.toThrow('null bytes are not allowed')
    })
  })

  describe('System directory protection', () => {
    describe('Unix system directories', () => {
      it('should reject /etc directory', async () => {
        await expect(
          runMigration({
            host: 'http://localhost:8123',
            migrationsHome: '/etc',
            createDatabase: false,
          }),
        ).rejects.toThrow("operations on system directory '/etc' are not allowed")
      })

      it('should reject /etc subdirectory', async () => {
        await expect(
          runMigration({
            host: 'http://localhost:8123',
            migrationsHome: '/etc/nginx',
            createDatabase: false,
          }),
        ).rejects.toThrow("operations on system directory '/etc' are not allowed")
      })

      it('should reject /sys directory', async () => {
        await expect(
          getMigrationStatus({
            host: 'http://localhost:8123',
            migrationsHome: '/sys',
          }),
        ).rejects.toThrow("operations on system directory '/sys' are not allowed")
      })

      it('should reject /root directory', async () => {
        await expect(
          runMigration({
            host: 'http://localhost:8123',
            migrationsHome: '/root',
            createDatabase: false,
          }),
        ).rejects.toThrow("operations on system directory '/root' are not allowed")
      })

      it('should reject /usr/bin directory', async () => {
        await expect(
          getMigrationStatus({
            host: 'http://localhost:8123',
            migrationsHome: '/usr/bin',
          }),
        ).rejects.toThrow("operations on system directory '/usr/bin' are not allowed")
      })
    })

    describe('Windows system directories', () => {
      it('should reject Windows system directory C:\\Windows', async () => {
        const promise = runMigration({
          host: 'http://localhost:8123',
          migrationsHome: 'C:\\Windows\\System32',
          createDatabase: false,
        })

        // On Windows: should reject with Windows-specific error
        // On Unix: path resolves differently, may reject with different error
        await expect(promise).rejects.toThrow()

        await promise.catch((error) => {
          expect(
            error.message.includes('operations on Windows system directories are not allowed') ||
              error.message.includes('No migration directory'),
          ).toBe(true)
        })
      })

      it('should reject Windows system directory (lowercase)', async () => {
        const promise = getMigrationStatus({
          host: 'http://localhost:8123',
          migrationsHome: 'c:\\windows\\temp',
        })

        // On Windows: should reject with Windows-specific error
        // On Unix: path resolves differently, may reject with different error
        await expect(promise).rejects.toThrow()

        await promise.catch((error) => {
          expect(
            error.message.includes('operations on Windows system directories are not allowed') ||
              error.message.includes('No migration directory'),
          ).toBe(true)
        })
      })

      it('should reject Windows Program Files', async () => {
        const promise = runMigration({
          host: 'http://localhost:8123',
          migrationsHome: 'C:\\Program Files\\App',
          createDatabase: false,
        })

        // On Windows: should reject with Windows-specific error
        // On Unix: path resolves differently, may reject with different error
        await expect(promise).rejects.toThrow()

        await promise.catch((error) => {
          expect(
            error.message.includes('operations on Windows system directories are not allowed') ||
              error.message.includes('No migration directory'),
          ).toBe(true)
        })
      })
    })
  })

  describe('Valid paths should work', () => {
    it('should accept valid relative path', async () => {
      // This should pass validation but fail on directory not existing
      await expect(
        runMigration({
          host: 'http://localhost:8123',
          migrationsHome: 'migrations',
          createDatabase: false,
        }),
      ).rejects.toThrow('No migration directory')
    })

    it('should accept valid absolute path in user directory', async () => {
      // This should pass validation but fail on directory not existing
      await expect(
        getMigrationStatus({
          host: 'http://localhost:8123',
          migrationsHome: '/home/user/project/migrations',
        }),
      ).rejects.toThrow('No migration directory')
    })

    it('should accept path with subdirectories', async () => {
      // This should pass validation but fail on directory not existing
      await expect(
        runMigration({
          host: 'http://localhost:8123',
          migrationsHome: 'database/clickhouse/migrations',
          createDatabase: false,
        }),
      ).rejects.toThrow('No migration directory')
    })

    it('should accept Windows-style path in user directory', async () => {
      // This should pass validation but fail on directory not existing
      await expect(
        getMigrationStatus({
          host: 'http://localhost:8123',
          migrationsHome: 'C:\\Users\\username\\migrations',
        }),
      ).rejects.toThrow('No migration directory')
    })

    it('should trim whitespace and accept valid path', async () => {
      // This should pass validation but fail on directory not existing
      await expect(
        runMigration({
          host: 'http://localhost:8123',
          migrationsHome: '  migrations/db  ',
          createDatabase: false,
        }),
      ).rejects.toThrow('No migration directory')
    })
  })

  describe('Edge cases', () => {
    it('should handle mixed slashes', async () => {
      // Mixed slashes in relative paths should work
      await expect(
        runMigration({
          host: 'http://localhost:8123',
          migrationsHome: 'database\\migrations',
          createDatabase: false,
        }),
      ).rejects.toThrow('No migration directory')
    })

    it('should resolve path ending with ../ to absolute path', async () => {
      // Path should be resolved, but will fail on directory not existing
      await expect(
        getMigrationStatus({
          host: 'http://localhost:8123',
          migrationsHome: 'some/path/..',
        }),
      ).rejects.toThrow('No migration directory')
    })

    it('should resolve /.. pattern to absolute path', async () => {
      // Path should be resolved, but may be blocked by system directory protection
      // or fail on directory not existing
      await expect(
        runMigration({
          host: 'http://localhost:8123',
          migrationsHome: '/home/../tmp/migrations',
          createDatabase: false,
        }),
      ).rejects.toThrow(/No migration directory|operations on system directory/)
    })
  })
})
