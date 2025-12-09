import { describe, expect, it } from 'vitest'
import { execute } from './helpers/cliHelper'

const envVars = {
  CH_MIGRATIONS_HOST: 'http://sometesthost:8123',
  CH_MIGRATIONS_USER: 'default',
  CH_MIGRATIONS_PASSWORD: '',
  CH_MIGRATIONS_DB: 'analytics',
  CH_MIGRATIONS_HOME: '/app/clickhouse/migrations',
}

describe('Execution tests', () => {
  it('No parameters provided', async () => {
    const result = await execute('node ./dist/cli.js migrate', { cwd: '.' })

    // Should fail with missing migrations-home (the only truly required option now)
    expect(result.stderr).toBe("error: required option '--migrations-home <dir>' not specified\n")
  })

  it('No migration directory', async () => {
    const command =
      'node ./dist/cli.js migrate --host=http://sometesthost:8123 --user=default --password="" --db=analytics --migrations-home=/app/clickhouse/migrations'

    const result = await execute(command, { cwd: '.' })

    // Logger outputs JSON by default, check that error message is present
    expect(result.stderr).toContain('No migration directory /app/clickhouse/migrations')
  })

  it('Environment variables are provided, but no migration directory', async () => {
    const result = await execute('node ./dist/cli.js migrate', { env: { ...process.env, ...envVars } })

    // Logger outputs JSON by default, check that error message is present
    expect(result.stderr).toContain('No migration directory /app/clickhouse/migrations')
  })

  it('Incorrectly named migration', async () => {
    const command =
      'node ./dist/cli.js migrate --host=http://sometesthost:8123 --user=default --password="" --db=analytics --migrations-home=tests/migrations/bad'

    const result = await execute(command, { cwd: '.' })

    // Logger outputs JSON by default, check that error message is present
    expect(result.stderr).toContain('Migration name should start from a non-negative integer')
    expect(result.stderr).toContain('bad_1.sql')
  })
})
