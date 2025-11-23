import { vi } from 'vitest'
import type { MockClickHouseClient } from './mockClickHouseClient'

/**
 * Reset all mock functions for a ClickHouse client
 */
export function resetClickHouseMocks(mockClient: MockClickHouseClient) {
  mockClient.mockQuery?.mockResolvedValue({ json: vi.fn().mockResolvedValue([]) })
  mockClient.mockExec?.mockResolvedValue({})
  mockClient.mockInsert?.mockResolvedValue({})
  mockClient.mockClose?.mockResolvedValue(undefined)
}

/**
 * Setup console spies that suppress output
 */
export function setupConsoleSpy() {
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

  return {
    consoleLogSpy,
    consoleErrorSpy,
    restore: () => {
      consoleLogSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    },
  }
}

/**
 * Calculate MD5 checksum of a string (for migration testing)
 */
export function calculateChecksum(content: string): string {
  const crypto = require('node:crypto')
  return crypto.createHash('md5').update(content).digest('hex')
}

/**
 * Standard beforeEach setup for integration tests
 */
export function setupIntegrationTest(mockClient: Partial<MockClickHouseClient>) {
  vi.clearAllMocks()
  resetClickHouseMocks(mockClient as MockClickHouseClient)
}

/**
 * Standard afterEach cleanup
 */
export function cleanupTest() {
  vi.restoreAllMocks()
}
