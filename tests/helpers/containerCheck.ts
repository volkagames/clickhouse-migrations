import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/**
 * Ensures a Docker container is running before executing E2E tests.
 *
 * @param containerName - The name of the Docker container to check
 * @param startCommand - Optional command to suggest for starting the container
 * @throws Error if the container is not running or Docker is unavailable
 *
 * @example
 * ```typescript
 * beforeAll(async () => {
 *   await ensureContainerRunning('clickhouse-server', 'docker-compose up -d clickhouse')
 * })
 * ```
 */
export async function ensureContainerRunning(containerName: string, startCommand?: string): Promise<void> {
  try {
    const { stdout } = await execAsync(`docker ps --filter "name=${containerName}" --format "{{.Status}}"`)
    if (stdout.includes('Up')) {
      console.log(`${containerName} container is running`)
    } else {
      const suggestion = startCommand ? ` Please start it with: ${startCommand}` : ''
      throw new Error(`${containerName} container is not running.${suggestion}`)
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('not running')) {
      throw error
    }

    // Detect Docker daemon not running
    const errorMsg = (error as Error).message
    if (errorMsg.includes('Cannot connect to the Docker daemon') || errorMsg.includes('docker daemon')) {
      throw new Error(
        `Docker is not running. Please start Docker and try again.${startCommand ? `\nThen start the container with: ${startCommand}` : ''}`,
      )
    }

    // Generic Docker error
    const suggestion = startCommand ? `\nTo start the container: ${startCommand}` : ''
    throw new Error(`Cannot check container status: ${errorMsg}${suggestion}`)
  }
}
