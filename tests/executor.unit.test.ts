import type { ClickHouseClient } from '@clickhouse/client'
import { describe, expect, it, vi } from 'vitest'

import { executeMigrationQueries } from '../src/executor'

describe('executeMigrationQueries', () => {
  it('uses command so DDL response streams are drained by the client', async () => {
    const command = vi.fn().mockResolvedValue({})
    const exec = vi.fn()
    const client = { command, exec } as unknown as ClickHouseClient
    const settings = { allow_experimental_json_type: '1' }
    const queries = [
      'CREATE TABLE source (id UInt64) ENGINE = MergeTree ORDER BY id',
      'CREATE MATERIALIZED VIEW source_mv ENGINE = Memory AS SELECT id FROM source',
    ]

    await executeMigrationQueries(client, queries, settings, '1_materialized_view.sql')

    const expectedSettings = { ...settings, wait_end_of_query: 1 }
    expect(command).toHaveBeenCalledTimes(2)
    expect(command).toHaveBeenNthCalledWith(1, { query: queries[0], clickhouse_settings: expectedSettings })
    expect(command).toHaveBeenNthCalledWith(2, { query: queries[1], clickhouse_settings: expectedSettings })
    expect(exec).not.toHaveBeenCalled()
  })
})
