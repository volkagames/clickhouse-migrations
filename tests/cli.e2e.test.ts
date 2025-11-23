import { exec } from 'node:child_process'
import * as path from 'node:path'
import { promisify } from 'node:util'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildCliCommand, runCliCommand } from './helpers/cliHelper'
import { ensureContainerRunning } from './helpers/containerCheck'
import { DOCKER_EXEC_TIMEOUT, E2E_TIMEOUT } from './helpers/testConstants'

const execAsync = promisify(exec)

/**
 * CLI E2E Tests
 *
 * Test for open source ClickHouse
 * - Database creation with default engine (no --db-engine specified)
 * - Database creation with custom engine (--db-engine specified)
 */

describe('CLI E2E Tests', () => {
  const testMigrationsDir = path.join(__dirname, 'migrations', 'one')

  beforeAll(async () => {
    await ensureContainerRunning('clickhouse-server', 'docker-compose up -d clickhouse')
  })

  it('should create database with default engine when no --db-engine specified', async () => {
    const dbName = `default_engine_test_${Date.now()}`

    try {
      const { output } = await runCliCommand(
        'migrate',
        {
          host: 'http://localhost:8123',
          user: 'default',
          password: '',
          db: dbName,
          'migrations-home': testMigrationsDir,
        },
        { timeout: E2E_TIMEOUT },
      )

      expect(output).toContain('1_init.sql was successfully applied')
    } catch (error: unknown) {
      console.error('Default engine test failed:', (error as Error).message)
      throw error
    }
  })

  it('should create database with custom engine when --db-engine specified', async () => {
    const dbName = `custom_engine_test_${Date.now()}`

    try {
      const { output } = await runCliCommand(
        'migrate',
        {
          host: 'http://localhost:8123',
          user: 'default',
          password: '',
          db: dbName,
          'migrations-home': testMigrationsDir,
          'db-engine': 'ENGINE=Atomic',
        },
        { timeout: E2E_TIMEOUT },
      )

      expect(output).toContain('1_init.sql was successfully applied')
    } catch (error: unknown) {
      console.error('Custom engine test failed:', (error as Error).message)
      throw error
    }
  })

  it('should show migration status with no applied migrations', async () => {
    const dbName = `status_test_empty_${Date.now()}`

    try {
      // Create database without applying migrations
      await execAsync(
        `docker exec clickhouse-server clickhouse-client --query="CREATE DATABASE IF NOT EXISTS ${dbName}"`,
        { timeout: DOCKER_EXEC_TIMEOUT },
      )

      // Run status command
      const { output } = await runCliCommand(
        'status',
        {
          host: 'http://localhost:8123',
          user: 'default',
          password: '',
          db: dbName,
          'migrations-home': testMigrationsDir,
        },
        { timeout: E2E_TIMEOUT },
      )

      expect(output).toContain('Migration Status:')
      expect(output).toContain('0 applied')
      expect(output).toContain('pending')
      expect(output).toContain('1_init.sql')
    } catch (error: unknown) {
      console.error('Status empty test failed:', (error as Error).message)
      throw error
    }
  })

  it('should show migration status with applied migrations', async () => {
    const dbName = `status_test_applied_${Date.now()}`

    try {
      // First apply migrations
      await runCliCommand(
        'migrate',
        {
          host: 'http://localhost:8123',
          user: 'default',
          password: '',
          db: dbName,
          'migrations-home': testMigrationsDir,
        },
        { timeout: E2E_TIMEOUT },
      )

      // Then check status
      const { output } = await runCliCommand(
        'status',
        {
          host: 'http://localhost:8123',
          user: 'default',
          password: '',
          db: dbName,
          'migrations-home': testMigrationsDir,
        },
        { timeout: E2E_TIMEOUT },
      )

      expect(output).toContain('Migration Status:')
      expect(output).toContain('1 applied')
      expect(output).toContain('0 pending')
      expect(output).toContain('1_init.sql')
      expect(output).toContain('applied at')
      expect(output).toContain('✓')
    } catch (error: unknown) {
      console.error('Status applied test failed:', (error as Error).message)
      throw error
    }
  })

  it('should detect checksum mismatch in status', async () => {
    const dbName = `status_test_checksum_${Date.now()}`
    const testMigrationsDirTwo = path.join(__dirname, 'migrations', 'two')

    try {
      // Apply migrations from 'one' directory
      await runCliCommand(
        'migrate',
        {
          host: 'http://localhost:8123',
          user: 'default',
          password: '',
          db: dbName,
          'migrations-home': testMigrationsDir,
        },
        { timeout: E2E_TIMEOUT },
      )

      // Check status with 'two' directory (different content, same filename)
      // The shell redirection '2>&1 || true' needs to be handled differently with our helper
      const cmd = buildCliCommand('status', {
        host: 'http://localhost:8123',
        user: 'default',
        password: '',
        db: dbName,
        'migrations-home': testMigrationsDirTwo,
      })

      const { stdout, stderr } = await execAsync(`${cmd} 2>&1 || true`, { timeout: E2E_TIMEOUT })
      const output = stdout + stderr

      expect(output).toContain('Migration Status:')
      // Should show warning about checksum mismatch
      expect(output).toMatch(/checksum mismatch|Warning.*checksum/i)
    } catch (error: unknown) {
      console.error('Status checksum test failed:', (error as Error).message)
      throw error
    }
  })

  it('should fail migrate with invalid credentials', async () => {
    try {
      await runCliCommand(
        'migrate',
        {
          host: 'http://localhost:8123',
          user: 'invalid_user',
          password: 'invalid_password',
          db: 'test_db',
          'migrations-home': testMigrationsDir,
        },
        { timeout: E2E_TIMEOUT },
      )
      throw new Error('Expected command to fail but it succeeded')
    } catch (error: unknown) {
      const errorMessage = (error as Error).message
      expect(errorMessage).toMatch(/authentication|auth|credentials|unauthorized|403/i)
    }
  })

  it('should fail status with invalid credentials', async () => {
    try {
      await runCliCommand(
        'status',
        {
          host: 'http://localhost:8123',
          user: 'invalid_user',
          password: 'invalid_password',
          db: 'test_db',
          'migrations-home': testMigrationsDir,
        },
        { timeout: E2E_TIMEOUT },
      )
      throw new Error('Expected command to fail but it succeeded')
    } catch (error: unknown) {
      const errorMessage = (error as Error).message
      expect(errorMessage).toMatch(/authentication|auth|credentials|unauthorized|403/i)
    }
  })

  // TODO: add test for creating database with Cloud-specific engine when --db-engine="ENGINE=Shared" is specified
})
