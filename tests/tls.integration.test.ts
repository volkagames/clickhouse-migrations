import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { execute } from './helpers/cliHelper'
import { getTLSCertificatePaths } from './helpers/tlsHelper'

describe('TLS Certificate Support Tests', () => {
  const { caCertPath, clientCertPath, clientKeyPath } = getTLSCertificatePaths()

  describe('CLI certificate options parsing', () => {
    it('should parse ca_cert command line option without syntax errors', async () => {
      const command = `node ./dist/cli.js migrate --host=https://localhost:8443 --user=default --password=secure123 --db=analytics --migrations-home=tests/migrations/one --ca-cert=${caCertPath}`

      const result = await execute(command, { cwd: '.' })

      // Should not have parsing errors for certificate options
      expect(result.stderr).not.toContain('unknown option')
      expect(result.stderr).not.toContain('ca_cert')
      expect(result.stderr).not.toContain('required option')

      // Should try to connect (and fail due to fake host)
      expect(result.stderr).toContain('Error')
    })

    it('should parse all certificate command line options without syntax errors', async () => {
      const command = `node ./dist/cli.js migrate --host=https://localhost:8443 --user=default --password=secure123 --db=analytics --migrations-home=tests/migrations/one --ca-cert=${caCertPath} --cert=${clientCertPath} --key=${clientKeyPath}`

      const result = await execute(command, { cwd: '.' })

      // Should not have parsing errors for any certificate options
      expect(result.stderr).not.toContain('unknown option')
      expect(result.stderr).not.toContain('ca_cert')
      // Check for CLI parsing errors, not connection errors mentioning "certificate"
      expect(result.stderr).not.toMatch(/unknown.*cert|required.*cert/)
      expect(result.stderr).not.toMatch(/unknown.*key|required.*key/)

      // Should try to connect (and fail due to connection issue or cert/password conflict)
      expect(result.stderr).toContain('Error')
    })

    it('should handle certificate environment variables without syntax errors', async () => {
      const envVars = {
        CH_MIGRATIONS_HOST: 'https://localhost:8443',
        CH_MIGRATIONS_USER: 'default',
        CH_MIGRATIONS_PASSWORD: 'secure123',
        CH_MIGRATIONS_DB: 'analytics',
        CH_MIGRATIONS_HOME: 'tests/migrations/one',
        CH_MIGRATIONS_TIMEOUT: '1000',
        CH_MIGRATIONS_CA_CERT: caCertPath,
        CH_MIGRATIONS_CERT: clientCertPath,
        CH_MIGRATIONS_KEY: clientKeyPath,
      }

      const result = await execute('node ./dist/cli.js migrate', { env: { ...process.env, ...envVars } })

      // Should not have parsing errors for certificate environment variables
      expect(result.stderr).not.toContain('unknown option')
      expect(result.stderr).not.toContain('required option')
      expect(result.stderr).not.toContain('CH_MIGRATIONS_CA_CERT')
      expect(result.stderr).not.toContain('CH_MIGRATIONS_CERT')
      expect(result.stderr).not.toContain('CH_MIGRATIONS_KEY')

      // Should try to connect (and fail due to fake host)
      expect(result.stderr).toContain('Error')
    })
  })

  describe('Certificate file validation', () => {
    it('should handle missing certificate files correctly', async () => {
      const nonExistentPath = '/path/to/nonexistent/ca.crt'
      const command = `node ./dist/cli.js migrate --host=https://localhost:8443 --user=default --password=secure123 --db=analytics --migrations-home=tests/migrations/one --ca-cert=${nonExistentPath}`

      const result = await execute(command, { cwd: '.' })

      // Should report file not found error
      expect(result.stderr).toContain('ENOENT')
    })

    it('should recognize certificate file existence', () => {
      // Verify the test certificate files exist
      expect(fs.existsSync(caCertPath)).toBe(true)
      expect(fs.existsSync(clientCertPath)).toBe(true)
      expect(fs.existsSync(clientKeyPath)).toBe(true)
    })

    it('should verify certificate files have correct PEM format', () => {
      const caCertContent = fs.readFileSync(caCertPath, 'utf8')
      const clientCertContent = fs.readFileSync(clientCertPath, 'utf8')
      const clientKeyContent = fs.readFileSync(clientKeyPath, 'utf8')

      // Verify certificate content has proper PEM format
      expect(caCertContent).toContain('-----BEGIN CERTIFICATE-----')
      expect(caCertContent).toContain('-----END CERTIFICATE-----')

      expect(clientCertContent).toContain('-----BEGIN CERTIFICATE-----')
      expect(clientCertContent).toContain('-----END CERTIFICATE-----')

      // Handle both standard private key and EC private key formats
      expect(clientKeyContent).toMatch(/-----BEGIN (EC )?PRIVATE KEY-----/)
      expect(clientKeyContent).toMatch(/-----END (EC )?PRIVATE KEY-----/)
    })
  })

  describe('CLI help and option documentation', () => {
    it('should show certificate options in help text', async () => {
      const result = await execute('node ./dist/cli.js migrate --help', { cwd: '.' })

      // Should show certificate options in help
      expect(result.stdout).toContain('--ca-cert')
      expect(result.stdout).toContain('--cert')
      expect(result.stdout).toContain('--key')
      expect(result.stdout).toContain('CA certificate file path')
      expect(result.stdout).toContain('Client certificate file path')
      expect(result.stdout).toContain('Client key file path')
    })
  })

  describe('Feature integration', () => {
    it('should work with other options like timeout and db-engine', async () => {
      const command = `node ./dist/cli.js migrate --host=https://localhost:8443 --user=default --password=secure123 --db=analytics --migrations-home=tests/migrations/one --db-engine="ENGINE=Atomic" --ca-cert=${caCertPath}`

      const result = await execute(command, { cwd: '.' })

      // Should not have parsing errors when combining with other options
      expect(result.stderr).not.toContain('unknown option')
      expect(result.stderr).not.toContain('required option')

      // Should try to connect (and fail due to fake host)
      expect(result.stderr).toContain('Error')
    })

    it('should accept only CA certificate without requiring client cert and key', async () => {
      const command = `node ./dist/cli.js migrate --host=https://localhost:8443 --user=default --password=secure123 --db=analytics --migrations-home=tests/migrations/one --ca-cert=${caCertPath}`

      const result = await execute(command, { cwd: '.' })

      // Should accept just CA certificate
      expect(result.stderr).not.toContain('unknown option')
      expect(result.stderr).not.toContain('required option')

      // Should try to connect (and fail due to fake host)
      expect(result.stderr).toContain('Error')
    })
  })
})
