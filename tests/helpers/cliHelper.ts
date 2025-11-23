import { type ExecException, exec, type ExecOptions as NodeExecOptions } from 'node:child_process'
import * as path from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export interface CliOptions {
  host?: string
  user?: string
  password?: string
  db?: string
  'migrations-home'?: string
  'ca-cert'?: string
  cert?: string
  key?: string
  'db-engine'?: string
  'table-engine'?: string
  [key: string]: string | boolean | undefined
}

export interface ExecOptions {
  timeout?: number
  env?: NodeJS.ProcessEnv
}

/**
 * Builds a CLI command string from the given command and options.
 *
 * @param command - The CLI command to run (e.g., 'migrate', 'status')
 * @param options - Key-value pairs for CLI flags
 * @returns The complete command string ready for execution
 *
 * @example
 * ```typescript
 * const cmd = buildCliCommand('migrate', {
 *   host: 'http://localhost:8123',
 *   user: 'default',
 *   db: 'mydb',
 *   'migrations-home': './migrations'
 * })
 * // Returns: 'node /path/to/cli.js migrate --host=http://localhost:8123 --user=default --db=mydb --migrations-home=./migrations'
 * ```
 */
export function buildCliCommand(command: string, options: CliOptions = {}): string {
  const cliPath = path.join(__dirname, '..', '..', 'lib', 'cli.js')
  const args = Object.entries(options)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => {
      if (typeof value === 'boolean') {
        return value ? `--${key}` : ''
      }
      return `--${key}=${value}`
    })
    .filter((arg) => arg !== '')
    .join(' ')

  return `node ${cliPath} ${command}${args ? ` ${args}` : ''}`
}

/**
 * Executes a CLI command and returns the combined stdout and stderr output.
 *
 * @param command - The CLI command to run (e.g., 'migrate', 'status')
 * @param options - Key-value pairs for CLI flags
 * @param execOptions - Execution options (timeout, env)
 * @returns Promise with stdout, stderr, and combined output
 *
 * @example
 * ```typescript
 * const { output } = await runCliCommand('migrate', {
 *   host: 'http://localhost:8123',
 *   db: 'mydb'
 * }, { timeout: 10000 })
 *
 * expect(output).toContain('successfully applied')
 * ```
 */
export async function runCliCommand(
  command: string,
  options: CliOptions = {},
  execOptions: ExecOptions = {},
): Promise<{ stdout: string; stderr: string; output: string }> {
  const cmd = buildCliCommand(command, options)
  const { stdout, stderr } = await execAsync(cmd, execOptions)
  return {
    stdout,
    stderr,
    output: stdout + stderr,
  }
}

/**
 * Gets the absolute path to the CLI executable.
 * Useful for tests that need the CLI path but construct commands differently.
 *
 * @returns Absolute path to cli.js
 */
export function getCliPath(): string {
  return path.join(__dirname, '..', '..', 'lib', 'cli.js')
}

/**
 * Execute a command with callback-based exec, wrapped in a Promise.
 * Useful for tests that need more control over execution.
 *
 * @param script - The command to execute
 * @param options - Node exec options (timeout, env, etc.)
 * @returns Promise with error, stdout, and stderr
 */
export function execute(
  script: string,
  options: NodeExecOptions,
): Promise<{ error: ExecException | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    exec(script, options, (error, stdout, stderr) => {
      resolve({ error, stdout: stdout.toString(), stderr: stderr.toString() })
    })
  })
}
