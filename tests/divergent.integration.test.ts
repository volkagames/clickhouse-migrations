import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { migration } from '../src/migrate';

// Mock the ClickHouse client module
const mockQuery = jest.fn();
const mockExec = jest.fn();
const mockInsert = jest.fn();
const mockClose = jest.fn();
const mockPing = jest.fn();

jest.mock('@clickhouse/client', () => ({
  createClient: jest.fn(() => ({
    query: mockQuery,
    exec: mockExec,
    insert: mockInsert,
    close: mockClose,
    ping: mockPing,
  })),
}));

describe('Divergent migration tests with abort_divergent flag', () => {
  let mockExit: jest.SpiedFunction<(code?: string | number | null | undefined) => never>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock process.exit to throw an error instead of actually exiting
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`process.exit: ${code}`);
    }) as jest.SpiedFunction<(code?: string | number | null | undefined) => never>;

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Setup default mock implementations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockPing as any).mockResolvedValue({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockExec as any).mockResolvedValue({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockInsert as any).mockResolvedValue({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockClose as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockExit.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('Should fail with abort_divergent=true when migration checksum differs', async () => {
    // Mock query to return an applied migration with different checksum
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockQuery as any).mockResolvedValueOnce({
      json: () => Promise.resolve([{ version: 1, checksum: 'old_checksum_value', migration_name: '1_init.sql' }]),
    });

    try {
      await migration(
        'tests/migrations/one',
        'http://sometesthost:8123',
        'default',
        '',
        'analytics',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true, // abort_divergent = true
      );
      // Should not reach here
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect((e as Error).message).toBe('process.exit: 1');
    }

    expect(mockExit).toHaveBeenCalledWith(1);

    // Check that the error was logged (last parameter can be empty string or undefined)
    const errorCall = consoleErrorSpy.mock.calls[0];
    expect(errorCall[0]).toBe('\x1b[36m');
    expect(errorCall[1]).toBe('clickhouse-migrations :');
    expect(errorCall[2]).toBe('\x1b[31m');
    expect(errorCall[3]).toBe(
      "Error: a migration file should't be changed after apply. Please, restore content of the 1_init.sql migrations.",
    );
  });

  it('Should continue with warning when abort_divergent=false and checksum differs', async () => {
    // Mock query to return an applied migration with different checksum
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockQuery as any).mockResolvedValueOnce({
      json: () => Promise.resolve([{ version: 1, checksum: 'old_checksum_value', migration_name: '1_init.sql' }]),
    });

    await migration(
      'tests/migrations/one',
      'http://sometesthost:8123',
      'default',
      '',
      'analytics',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      false, // abort_divergent = false
    );

    // Should not exit
    expect(mockExit).not.toHaveBeenCalled();

    // Should log warning message
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\x1b[36m',
      'clickhouse-migrations :',
      '\x1b[0m',
      'Warning: applied migration 1_init.sql has different checksum than the file on filesystem. Continuing due to --abort-divergent=false.',
    );

    // Should also log success message for no new migrations
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\x1b[36m',
      'clickhouse-migrations :',
      '\x1b[0m',
      'No migrations to apply.',
    );
  });
});
