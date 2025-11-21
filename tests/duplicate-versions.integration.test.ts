import { describe, expect, it } from '@jest/globals';

import { migration } from '../src/migrate';

jest.mock('@clickhouse/client', () => ({ createClient: () => createClient1 }));

const createClient1 = {
  query: jest.fn(() => Promise.resolve({ json: () => [] })),
  exec: jest.fn(() => Promise.resolve({})),
  insert: jest.fn(() => Promise.resolve({})),
  close: jest.fn(() => Promise.resolve()),
  ping: jest.fn(() => Promise.resolve()),
};

describe('Duplicate version validation', () => {
  it('Should reject migrations with duplicate versions', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`process.exit called with code ${code}`);
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await expect(
      migration(
        'tests/migrations/duplicate-versions',
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
        true,
        false, // create_database = false (since we check migration files before DB operations)
      ),
    ).rejects.toThrow('process.exit called with code 1');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.stringContaining('Found duplicate migration version'),
      expect.anything(),
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.stringContaining('version 1'),
      expect.anything(),
    );

    mockExit.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
