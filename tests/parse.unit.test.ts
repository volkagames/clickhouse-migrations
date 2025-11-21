import { describe, it, expect } from '@jest/globals';

import { sql_queries, sql_sets } from '../src/sql-parse';

describe('Sql query parse', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('1 query test', async () => {
    const input = '-- any\n\n# other comment\n\n#! also comment\n  SELECT * \nFROM events;\n';

    const output = ['SELECT * FROM events'];

    expect(sql_queries(input)).toEqual(output);
  });

  it('should preserve -- inside string literals (bug fix)', async () => {
    const input = "SELECT '-- not a comment' AS text, name FROM users;";

    const output = ["SELECT '-- not a comment' AS text, name FROM users"];

    expect(sql_queries(input)).toEqual(output);
  });

  it('should remove inline comments after code (PostgreSQL style)', async () => {
    const input = 'SELECT * FROM table; -- inline comment\nSELECT id FROM users;';

    const output = ['SELECT * FROM table', 'SELECT id FROM users'];

    expect(sql_queries(input)).toEqual(output);
  });

  it('should handle comments with leading whitespace', async () => {
    const input = '  -- comment with spaces\n\t-- comment with tab\nSELECT 1;';

    const output = ['SELECT 1'];

    expect(sql_queries(input)).toEqual(output);
  });

  it('should handle multiple queries with comments', async () => {
    const input = '-- First query\nSELECT * FROM users;\n-- Second query\nSELECT * FROM events;';

    const output = ['SELECT * FROM users', 'SELECT * FROM events'];

    expect(sql_queries(input)).toEqual(output);
  });

  it('should preserve # inside string literals', async () => {
    const input = "SELECT '# not a comment' AS text FROM table;";

    const output = ["SELECT '# not a comment' AS text FROM table"];

    expect(sql_queries(input)).toEqual(output);
  });

  it('should remove single-line block comment', async () => {
    const input = 'SELECT /* inline comment */ * FROM users;';

    const output = ['SELECT * FROM users'];

    expect(sql_queries(input)).toEqual(output);
  });

  it('should remove multi-line block comment', async () => {
    const input = `SELECT order_id, quantity
/*
 * Author: TechOnTheNet.com
 * Purpose: To show a comment that spans multiple lines
 */
FROM orders;`;

    const output = ['SELECT order_id, quantity FROM orders'];

    expect(sql_queries(input)).toEqual(output);
  });

  it('should remove multiple block comments', async () => {
    const input = '/* Comment 1 */ SELECT /* Comment 2 */ * FROM users /* Comment 3 */;';

    const output = ['SELECT * FROM users'];

    expect(sql_queries(input)).toEqual(output);
  });

  it('should handle mixed comment types', async () => {
    const input = `-- Single line comment
/* Block comment */
SELECT * FROM users;
-- Another single line
/* Another
   block comment */
SELECT * FROM events;`;

    const output = ['SELECT * FROM users', 'SELECT * FROM events'];

    expect(sql_queries(input)).toEqual(output);
  });

  it('should preserve /* */ inside string literals', async () => {
    const input = "SELECT '/* text */' AS comment, name FROM table;";

    const output = ["SELECT '/* text */' AS comment, name FROM table"];

    expect(sql_queries(input)).toEqual(output);
  });

  it('should handle PostgreSQL-style inline comments in CREATE TABLE', async () => {
    const input = `CREATE TABLE cmt_example(
id INT, --creating an INTEGER type column
name TEXT --creating a character type column
);`;

    const output = ['CREATE TABLE cmt_example( id INT, name TEXT )'];

    expect(sql_queries(input)).toEqual(output);
  });

  it('should preserve -- inside string literals with inline comments', async () => {
    const input = "SELECT '-- not a comment' AS text -- this is a comment\nFROM users;";

    const output = ["SELECT '-- not a comment' AS text FROM users"];

    expect(sql_queries(input)).toEqual(output);
  });

  it('should handle mixed block comments and string literals', async () => {
    const input = "SELECT /* comment */ '/* not a comment */' AS text, id /* another */ FROM users;";

    const output = ["SELECT '/* not a comment */' AS text, id FROM users"];

    expect(sql_queries(input)).toEqual(output);
  });

  it('should preserve escaped quotes inside strings', async () => {
    const input = "SELECT 'it\\'s /* a */ test' AS text FROM users;";

    const output = ["SELECT 'it\\'s /* a */ test' AS text FROM users"];

    expect(sql_queries(input)).toEqual(output);
  });
});

describe('Sql settings parse', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('one set and comments with no end of lines', async () => {
    const input = '-- any\nSET allow_experimental_json_type = 1;\n\n --set option\nSELECT * FROM events';

    const output = { allow_experimental_json_type: '1' };

    expect(sql_sets(input)).toEqual(output);
  });

  it('two sets and comments', async () => {
    const input =
      '-- any\nSET allow_experimental_json_type = 1;\n-- set option\nSET allow_experimental_object_new = 1;\nSELECT * \n  --comment\n  FROM events\n';

    const output = { allow_experimental_json_type: '1', allow_experimental_object_new: '1' };

    expect(sql_sets(input)).toEqual(output);
  });

  it('set with equals sign in value', async () => {
    const input = "SET option = 'value=something';\nSELECT * FROM events";

    const output = { option: 'value=something' };

    expect(sql_sets(input)).toEqual(output);
  });

  it('set without value should be ignored', async () => {
    const input = 'SET option_without_value;\nSET valid_option = 1;\nSELECT * FROM events';

    const output = { valid_option: '1' };

    expect(sql_sets(input)).toEqual(output);
  });

  it('set with quoted value', async () => {
    const input = "SET string_option = 'sometext';\nSET number_option = 123;\nSELECT * FROM events";

    const output = { string_option: 'sometext', number_option: '123' };

    expect(sql_sets(input)).toEqual(output);
  });
});
