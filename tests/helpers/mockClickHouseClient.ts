import { vi } from 'vitest'

/**
 * Type representing the return value of createMockClickHouseClient
 */
export type MockClickHouseClient = ReturnType<typeof createMockClickHouseClient>

/**
 * Type for partial mock client used in test setup
 */
export type PartialMockClickHouseClient = Partial<MockClickHouseClient>

/**
 * Creates a mock ClickHouse client with all necessary methods mocked.
 * This provides a consistent mock structure across all integration tests.
 *
 * @returns An object containing the mock client and individual mock functions
 *
 * @example
 * ```typescript
 * import { createMockClickHouseClient } from '../helpers/mockClickHouseClient'
 *
 * const { mockClient, mockQuery, mockExec } = createMockClickHouseClient()
 *
 * vi.mock('@clickhouse/client', () => ({
 *   createClient: vi.fn(() => mockClient)
 * }))
 * ```
 */
export function createMockClickHouseClient() {
  const mockQuery = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve([]) as Promise<Array<Record<string, unknown>>> }),
  )
  const mockExec = vi.fn(() => Promise.resolve({}))
  const mockInsert = vi.fn(() => Promise.resolve({}))
  const mockClose = vi.fn(() => Promise.resolve())
  const mockPing = vi.fn(() => Promise.resolve())

  const mockClient = {
    query: mockQuery,
    exec: mockExec,
    insert: mockInsert,
    close: mockClose,
    ping: mockPing,
  }

  return {
    mockClient,
    mockQuery,
    mockExec,
    mockInsert,
    mockClose,
    mockPing,
  }
}
