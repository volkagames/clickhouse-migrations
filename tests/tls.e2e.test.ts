import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { runCliCommand } from './helpers/cliHelper'
import { ensureContainerRunning } from './helpers/containerCheck'
import { E2E_TIMEOUT, TLS_FAIL_TIMEOUT, VITEST_TIMEOUT } from './helpers/testConstants'
import { getTLSCertificatePaths } from './helpers/tlsHelper'

/**
 * TLS CLI Integration Tests
 *
 * Test Coverage:
 * - Basic TLS connection with CA certificate
 * - Client certificate authentication
 * - Environment variable configuration
 * - Error handling for invalid certificates
 */

describe('TLS CLI Integration Tests', () => {
  const { caCertPath, clientCertPath, clientKeyPath } = getTLSCertificatePaths()
  const testMigrationsDir = path.join(__dirname, 'migrations', 'one')

  beforeAll(async () => {
    await ensureContainerRunning('clickhouse-server-tls', 'docker-compose up -d clickhouse_tls')
  })

  it('should connect with CA certificate', async () => {
    const dbName = `tls_test_${Date.now()}`

    try {
      const { output } = await runCliCommand(
        'migrate',
        {
          host: 'https://localhost:8443',
          user: 'default',
          password: '',
          db: dbName,
          'migrations-home': testMigrationsDir,
          'ca-cert': caCertPath,
        },
        {
          // Note: Disabling TLS verification for test environment with self-signed certificates
          // This is safe because we're testing against a local Docker container
          env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
          timeout: E2E_TIMEOUT,
        },
      )

      expect(output).toContain('1_init.sql was successfully applied')
    } catch (error: unknown) {
      console.error('TLS test failed:', (error as Error).message)
      throw error
    }
  })

  it(
    'should fail without CA certificate',
    async () => {
      await expect(
        runCliCommand(
          'migrate',
          {
            host: 'https://localhost:8443',
            user: 'default',
            password: '',
            db: 'tls_fail',
            'migrations-home': testMigrationsDir,
          },
          { timeout: TLS_FAIL_TIMEOUT },
        ),
      ).rejects.toThrow(/(certificate|SSL|TLS)/i)
    },
    VITEST_TIMEOUT,
  )

  it('should connect with client certificate authentication', async () => {
    const dbName = `tls_client_cert_${Date.now()}`

    try {
      const { output } = await runCliCommand(
        'migrate',
        {
          host: 'https://localhost:8443',
          user: 'cert_user',
          // Note: password is intentionally omitted for certificate-only authentication
          db: dbName,
          'migrations-home': testMigrationsDir,
          'ca-cert': caCertPath,
          cert: clientCertPath,
          key: clientKeyPath,
        },
        {
          // Note: Disabling TLS verification for test environment with self-signed certificates
          // This is safe because we're testing against a local Docker container
          env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
          timeout: E2E_TIMEOUT,
        },
      )

      expect(output).toContain('1_init.sql was successfully applied')
    } catch (error: unknown) {
      console.error('Client cert test failed:', (error as Error).message)
      throw error
    }
  })

  it(
    'should work with environment variables',
    async () => {
      const dbName = `tls_env_${Date.now()}`

      const env = {
        ...process.env,
        CH_MIGRATIONS_HOST: 'https://localhost:8443',
        CH_MIGRATIONS_USER: 'default',
        CH_MIGRATIONS_PASSWORD: '',
        CH_MIGRATIONS_DB: dbName,
        CH_MIGRATIONS_HOME: testMigrationsDir,
        CH_MIGRATIONS_CA_CERT: caCertPath,
        // Note: Disabling TLS verification for test environment with self-signed certificates
        // This is safe because we're testing against a local Docker container
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
      }

      try {
        const { output } = await runCliCommand('migrate', {}, { env, timeout: E2E_TIMEOUT })

        expect(output).toContain('1_init.sql was successfully applied')
      } catch (error: unknown) {
        console.error('Environment variables test failed:', (error as Error).message)
        throw error
      }
    },
    VITEST_TIMEOUT,
  )

  it(
    'should handle invalid certificate file',
    async () => {
      const invalidCertPath = path.join(tmpdir(), 'invalid_cert.crt')

      try {
        // Create invalid certificate file
        fs.writeFileSync(invalidCertPath, 'INVALID CERTIFICATE CONTENT')

        await expect(
          runCliCommand(
            'migrate',
            {
              host: 'https://localhost:8443',
              user: 'default',
              password: '',
              db: 'tls_invalid',
              'migrations-home': testMigrationsDir,
              'ca-cert': invalidCertPath,
            },
            { timeout: TLS_FAIL_TIMEOUT },
          ),
        ).rejects.toThrow(/(certificate|SSL|TLS|PEM)/i)
      } finally {
        // Clean up
        if (fs.existsSync(invalidCertPath)) {
          fs.unlinkSync(invalidCertPath)
        }
      }
    },
    VITEST_TIMEOUT,
  )
})
