import * as fs from 'node:fs'
import * as clickhouse from '@clickhouse/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '../src/logger'
import { runMigration } from '../src/migrate'
import { createMockClickHouseClient } from './helpers/mockClickHouseClient'
import { MIGRATION_WITH_TLS_TIMEOUT } from './helpers/testConstants'
import { cleanupTest } from './helpers/testSetup'
import { getTLSCertificatePaths } from './helpers/tlsHelper'

// Mock the ClickHouse client to capture the connection parameters
const { mockClient } = createMockClickHouseClient()

vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => mockClient),
}))

const mockCreateClient = clickhouse.createClient as unknown as ReturnType<typeof vi.fn>

describe('TLS Configuration Unit Tests', () => {
  const { caCertPath, clientCertPath, clientKeyPath } = getTLSCertificatePaths()

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateClient.mockReturnValue(mockClient)
  })

  afterEach(() => {
    cleanupTest()
  })

  describe('TLS configuration building', () => {
    it('should create ClickHouse client without TLS when no certificates provided', async () => {
      const logger = createLogger()
      await runMigration({
        migrationsHome: 'tests/migrations/one',
        host: 'http://clickhouse:8123',
        username: 'default',
        password: '',
        dbName: 'analytics',
        abortDivergent: true,
        createDatabase: true,
        logger,
      })

      // Verify createClient was called without TLS configuration
      expect(mockCreateClient).toHaveBeenCalled()

      // Check that none of the calls include TLS configuration
      type CallArgs = [config?: Record<string, unknown>]
      const calls = mockCreateClient.mock.calls as CallArgs[]
      for (const call of calls) {
        expect(call[0]).not.toHaveProperty('tls')
      }
    })

    it('should create ClickHouse client with CA certificate only', async () => {
      const logger = createLogger()
      await runMigration({
        migrationsHome: 'tests/migrations/one',
        host: 'https://secure-clickhouse:8443',
        username: 'default',
        password: 'password',
        dbName: 'analytics',
        dbEngine: 'ENGINE=Atomic',
        tableEngine: 'MergeTree',
        timeout: MIGRATION_WITH_TLS_TIMEOUT,
        caCert: caCertPath,
        abortDivergent: true,
        createDatabase: true,
        logger,
      })

      // Verify createClient was called with TLS configuration containing only CA cert
      type CallArgs = [config?: Record<string, unknown>]
      const calls = mockCreateClient.mock.calls as CallArgs[]
      expect(calls.length).toBeGreaterThan(0)

      const tlsCalls = calls.filter((call) => call[0] && 'tls' in call[0])
      expect(tlsCalls.length).toBeGreaterThan(0)

      for (const call of tlsCalls) {
        const config = call[0] as { tls: Record<string, unknown> }
        expect(config.tls).toHaveProperty('ca_cert')
        expect(config.tls.ca_cert).toBeInstanceOf(Buffer)
        // Should not have client cert/key when only CA is provided
        expect(config.tls).not.toHaveProperty('cert')
        expect(config.tls).not.toHaveProperty('key')
      }
    })

    it('should create ClickHouse client with full TLS configuration', async () => {
      const logger = createLogger()
      await runMigration({
        migrationsHome: 'tests/migrations/one',
        host: 'https://secure-clickhouse:8443',
        username: 'default',
        password: 'password',
        dbName: 'analytics',
        dbEngine: 'ENGINE=Atomic',
        tableEngine: 'MergeTree',
        timeout: MIGRATION_WITH_TLS_TIMEOUT,
        caCert: caCertPath,
        cert: clientCertPath,
        key: clientKeyPath,
        abortDivergent: true,
        createDatabase: true,
        logger,
      })

      // Verify createClient was called with complete TLS configuration
      type CallArgs = [config?: Record<string, unknown>]
      const calls = mockCreateClient.mock.calls as CallArgs[]
      expect(calls.length).toBeGreaterThan(0)

      const tlsCalls = calls.filter((call) => call[0] && 'tls' in call[0])
      expect(tlsCalls.length).toBeGreaterThan(0)

      for (const call of tlsCalls) {
        const config = call[0] as { tls: Record<string, Buffer> }
        expect(config.tls).toHaveProperty('ca_cert')
        expect(config.tls).toHaveProperty('cert')
        expect(config.tls).toHaveProperty('key')

        expect(config.tls.ca_cert).toBeInstanceOf(Buffer)
        expect(config.tls.cert).toBeInstanceOf(Buffer)
        expect(config.tls.key).toBeInstanceOf(Buffer)
      }
    })

    it('should combine TLS configuration with other connection options', async () => {
      const logger = createLogger()
      await runMigration({
        migrationsHome: 'tests/migrations/one',
        host: 'https://secure-clickhouse:8443',
        username: 'default',
        password: 'password',
        dbName: 'analytics',
        dbEngine: 'ON CLUSTER production ENGINE=Replicated',
        tableEngine: 'MergeTree',
        timeout: MIGRATION_WITH_TLS_TIMEOUT,
        caCert: caCertPath,
        cert: clientCertPath,
        key: clientKeyPath,
        abortDivergent: true,
        createDatabase: true,
        logger,
      })

      type CallArgs = [config?: Record<string, unknown>]
      const calls = mockCreateClient.mock.calls as CallArgs[]
      const dbCreationCall = calls.find((call) => call[0] && !('database' in call[0]))
      const migrationCall = calls.find((call) => call[0] && 'database' in call[0])

      // Verify database creation call
      // Note: password should NOT be present when using certificate authentication
      expect(dbCreationCall).toBeDefined()
      expect(dbCreationCall?.[0]).toMatchObject({
        url: 'https://secure-clickhouse:8443',
        username: 'default',
        application: 'clickhouse-migrations',
        request_timeout: MIGRATION_WITH_TLS_TIMEOUT,
      })
      expect(dbCreationCall?.[0]).toHaveProperty('tls')
      expect(dbCreationCall?.[0]).not.toHaveProperty('password')

      // Verify migration call
      // Note: password should NOT be present when using certificate authentication
      expect(migrationCall).toBeDefined()
      expect(migrationCall?.[0]).toMatchObject({
        url: 'https://secure-clickhouse:8443',
        username: 'default',
        database: 'analytics',
        application: 'clickhouse-migrations',
        request_timeout: MIGRATION_WITH_TLS_TIMEOUT,
      })
      expect(migrationCall?.[0]).toHaveProperty('tls')
      expect(migrationCall?.[0]).not.toHaveProperty('password')
    })
  })

  describe('Certificate content validation', () => {
    it('should read actual certificate content from files', async () => {
      const logger = createLogger()
      await runMigration({
        migrationsHome: 'tests/migrations/one',
        host: 'https://secure-clickhouse:8443',
        username: 'default',
        password: 'password',
        dbName: 'analytics',
        dbEngine: 'ENGINE=Atomic',
        tableEngine: 'MergeTree',
        timeout: MIGRATION_WITH_TLS_TIMEOUT,
        caCert: caCertPath,
        cert: clientCertPath,
        key: clientKeyPath,
        abortDivergent: true,
        createDatabase: true,
        logger,
      })

      type CallArgs = [config?: Record<string, unknown>]
      const calls = mockCreateClient.mock.calls as CallArgs[]
      const tlsCall = calls.find((call) => call[0] && 'tls' in call[0])

      expect(tlsCall).toBeDefined()
      const config = tlsCall?.[0] as { tls: Record<string, Buffer> } | undefined
      const tlsConfig = config?.tls

      // Read expected certificate content
      const expectedCaCert = fs.readFileSync(caCertPath)
      const expectedClientCert = fs.readFileSync(clientCertPath)
      const expectedClientKey = fs.readFileSync(clientKeyPath)

      // Verify the content matches what was read from files
      expect(tlsConfig).toBeDefined()
      expect(tlsConfig?.ca_cert).toEqual(expectedCaCert)
      expect(tlsConfig?.cert).toEqual(expectedClientCert)
      expect(tlsConfig?.key).toEqual(expectedClientKey)
    })
  })

  describe('Database creation with TLS', () => {
    it('should use TLS for both database creation and migration operations', async () => {
      const logger = createLogger()
      await runMigration({
        migrationsHome: 'tests/migrations/one',
        host: 'https://secure-clickhouse:8443',
        username: 'default',
        password: 'password',
        dbName: 'analytics',
        dbEngine: 'ENGINE=Atomic',
        tableEngine: 'MergeTree',
        timeout: MIGRATION_WITH_TLS_TIMEOUT,
        caCert: caCertPath,
        abortDivergent: true,
        createDatabase: true,
        logger,
      })

      // Should have exactly 2 calls: one for DB creation, one for migrations
      expect(mockCreateClient).toHaveBeenCalledTimes(2)

      type CallArgs = [config?: Record<string, unknown>]
      const calls = mockCreateClient.mock.calls as CallArgs[]

      // Both calls should have TLS configuration
      for (const call of calls) {
        expect(call[0]).toHaveProperty('tls')
        const config = call[0] as { tls: Record<string, Buffer> }
        expect(config.tls).toHaveProperty('ca_cert')
        expect(config.tls.ca_cert).toBeInstanceOf(Buffer)
      }

      // First call should be for database creation (no database specified)
      expect(calls[0]).toBeDefined()
      expect(calls[0]?.[0]).not.toHaveProperty('database')

      // Second call should be for migrations (with database specified)
      expect(calls[1]).toBeDefined()
      expect(calls[1]?.[0]).toHaveProperty('database', 'analytics')
    })
  })
})
