import { describe, it, expect } from '@jest/globals';

import { sqlQueries, sqlSets } from '../src/sql-parse';

describe('Sql query parse', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('1 query test', async () => {
    const input = '-- any\n\n# other comment\n\n#! also comment\n  SELECT * \nFROM events;\n';

    const output = ['SELECT * FROM events'];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should preserve -- inside string literals (bug fix)', async () => {
    const input = "SELECT '-- not a comment' AS text, name FROM users;";

    const output = ["SELECT '-- not a comment' AS text, name FROM users"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should remove inline comments after code (PostgreSQL style)', async () => {
    const input = 'SELECT * FROM table; -- inline comment\nSELECT id FROM users;';

    const output = ['SELECT * FROM table', 'SELECT id FROM users'];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should handle comments with leading whitespace', async () => {
    const input = '  -- comment with spaces\n\t-- comment with tab\nSELECT 1;';

    const output = ['SELECT 1'];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should handle multiple queries with comments', async () => {
    const input = '-- First query\nSELECT * FROM users;\n-- Second query\nSELECT * FROM events;';

    const output = ['SELECT * FROM users', 'SELECT * FROM events'];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should preserve # inside string literals', async () => {
    const input = "SELECT '# not a comment' AS text FROM table;";

    const output = ["SELECT '# not a comment' AS text FROM table"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should remove single-line block comment', async () => {
    const input = 'SELECT /* inline comment */ * FROM users;';

    const output = ['SELECT * FROM users'];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should remove multi-line block comment', async () => {
    const input = `SELECT order_id, quantity
/*
 * Author: TechOnTheNet.com
 * Purpose: To show a comment that spans multiple lines
 */
FROM orders;`;

    const output = ['SELECT order_id, quantity FROM orders'];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should remove multiple block comments', async () => {
    const input = '/* Comment 1 */ SELECT /* Comment 2 */ * FROM users /* Comment 3 */;';

    const output = ['SELECT * FROM users'];

    expect(sqlQueries(input)).toEqual(output);
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

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should preserve /* */ inside string literals', async () => {
    const input = "SELECT '/* text */' AS comment, name FROM table;";

    const output = ["SELECT '/* text */' AS comment, name FROM table"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should handle PostgreSQL-style inline comments in CREATE TABLE', async () => {
    const input = `CREATE TABLE cmt_example(
id INT, --creating an INTEGER type column
name TEXT --creating a character type column
);`;

    const output = ['CREATE TABLE cmt_example( id INT, name TEXT )'];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should preserve -- inside string literals with inline comments', async () => {
    const input = "SELECT '-- not a comment' AS text -- this is a comment\nFROM users;";

    const output = ["SELECT '-- not a comment' AS text FROM users"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should handle mixed block comments and string literals', async () => {
    const input = "SELECT /* comment */ '/* not a comment */' AS text, id /* another */ FROM users;";

    const output = ["SELECT '/* not a comment */' AS text, id FROM users"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should preserve escaped quotes inside strings', async () => {
    const input = "SELECT 'it\\'s /* a */ test' AS text FROM users;";

    const output = ["SELECT 'it\\'s /* a */ test' AS text FROM users"];

    expect(sqlQueries(input)).toEqual(output);
  });

  // Bug fix Doubled quotes handling
  it('should handle doubled single quotes (SQL escape)', async () => {
    const input = "SELECT 'it''s a test' AS text FROM users;";

    const output = ["SELECT 'it''s a test' AS text FROM users"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should handle doubled double quotes', async () => {
    const input = 'SELECT "say ""hello""" AS text FROM users;';

    const output = ['SELECT "say ""hello""" AS text FROM users'];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should handle multiple doubled quotes in one string', async () => {
    const input = "SELECT 'don''t say ''no''' AS text FROM users;";

    const output = ["SELECT 'don''t say ''no''' AS text FROM users"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should handle doubled quotes with comments', async () => {
    const input = "SELECT 'it''s -- not a comment' AS text -- real comment\nFROM users;";

    const output = ["SELECT 'it''s -- not a comment' AS text FROM users"];

    expect(sqlQueries(input)).toEqual(output);
  });

  // Bug fix Block comments with string literals inside
  it('should handle /* */ with string literals containing */', async () => {
    const input = "/* comment with 'string containing */' inside */ SELECT * FROM users;";

    const output = ["SELECT * FROM users"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should handle nested-looking block comments with quotes', async () => {
    const input = "/* outer comment /* with 'fake */ inside string' */ SELECT id FROM table;";

    const output = ["SELECT id FROM table"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should handle block comment with multiple string literals', async () => {
    const input = "/* comment 'str1 */' and \"str2 */\" here */ SELECT 1;";

    const output = ["SELECT 1"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should handle complex case: block comment with doubled quotes', async () => {
    const input = "/* comment with 'don''t stop here */' text */ SELECT 'it''s ok' FROM users;";

    const output = ["SELECT 'it''s ok' FROM users"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should return empty array for null/undefined input', async () => {
    expect(sqlQueries(null as any)).toEqual([]);
    expect(sqlQueries(undefined as any)).toEqual([]);
  });

  it('should return empty array for empty string', async () => {
    expect(sqlQueries('')).toEqual([]);
    expect(sqlQueries('   ')).toEqual([]);
  });

  it('should return empty array for non-string input', async () => {
    expect(sqlQueries(123 as any)).toEqual([]);
    expect(sqlQueries({} as any)).toEqual([]);
    expect(sqlQueries([] as any)).toEqual([]);
  });

  it('should preserve backticks for ClickHouse identifiers', async () => {
    const input = "SELECT `column-with-dash` FROM `table-name`;";

    const output = ["SELECT `column-with-dash` FROM `table-name`"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should handle backticks with comments', async () => {
    const input = "SELECT `field` FROM `db`.`table`; -- comment with `backticks`";

    const output = ["SELECT `field` FROM `db`.`table`"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should handle backticks in block comments', async () => {
    const input = "/* comment with `identifier` */ SELECT `name` FROM users;";

    const output = ["SELECT `name` FROM users"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should handle mixed quotes and backticks', async () => {
    const input = "SELECT `col`, 'value', \"text\" FROM `table`;";

    const output = ["SELECT `col`, 'value', \"text\" FROM `table`"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should handle escaped backticks', async () => {
    const input = "SELECT `column\\`name` FROM users;";

    const output = ["SELECT `column\\`name` FROM users"];

    expect(sqlQueries(input)).toEqual(output);
  });

  // Bug fix #1: Unterminated block comment should throw error
  it('should throw error for unterminated block comment', async () => {
    const input = "SELECT * FROM users; /* unterminated comment";

    expect(() => sqlQueries(input)).toThrow('Unterminated block comment in SQL');
  });

  it('should throw error for unterminated block comment with string inside', async () => {
    const input = "SELECT * FROM users; /* comment with 'string' but no end";

    expect(() => sqlQueries(input)).toThrow('Unterminated block comment in SQL');
  });

  // Bug fix #2: Whitespace preservation when removing block comments
  it('should preserve whitespace when removing inline block comment', async () => {
    const input = "SELECT/*comment*/column FROM table;";

    const output = ["SELECT column FROM table"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should preserve whitespace when removing multiple inline block comments', async () => {
    const input = "SELECT/*c1*/id,/*c2*/name/*c3*/FROM/*c4*/users;";

    const output = ["SELECT id, name FROM users"];

    expect(sqlQueries(input)).toEqual(output);
  });

  it('should not create double spaces when block comment is between spaces', async () => {
    const input = "SELECT /* comment */ column FROM table;";

    // The comment is replaced with a space, but surrounding spaces remain
    // This results in proper spacing: "SELECT  column FROM table"
    // which after .replace(/\s+/g, ' ') becomes "SELECT column FROM table"
    const output = ["SELECT column FROM table"];

    expect(sqlQueries(input)).toEqual(output);
  });
});

describe('Sql settings parse', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('one set and comments with no end of lines', async () => {
    const input = '-- any\nSET allow_experimental_json_type = 1;\n\n --set option\nSELECT * FROM events';

    const output = { allow_experimental_json_type: '1' };

    expect(sqlSets(input)).toEqual(output);
  });

  it('two sets and comments', async () => {
    const input =
      '-- any\nSET allow_experimental_json_type = 1;\n-- set option\nSET allow_experimental_object_new = 1;\nSELECT * \n  --comment\n  FROM events\n';

    const output = { allow_experimental_json_type: '1', allow_experimental_object_new: '1' };

    expect(sqlSets(input)).toEqual(output);
  });

  it('set with equals sign in value', async () => {
    const input = "SET option = 'value=something';\nSELECT * FROM events";

    const output = { option: 'value=something' };

    expect(sqlSets(input)).toEqual(output);
  });

  it('set without value should be ignored', async () => {
    const input = 'SET option_without_value;\nSET valid_option = 1;\nSELECT * FROM events';

    const output = { valid_option: '1' };

    expect(sqlSets(input)).toEqual(output);
  });

  it('set with quoted value', async () => {
    const input = "SET string_option = 'sometext';\nSET number_option = 123;\nSELECT * FROM events";

    const output = { string_option: 'sometext', number_option: '123' };

    expect(sqlSets(input)).toEqual(output);
  });

  it('should return empty object for null/undefined input', async () => {
    expect(sqlSets(null as any)).toEqual({});
    expect(sqlSets(undefined as any)).toEqual({});
  });

  it('should return empty object for empty string', async () => {
    expect(sqlSets('')).toEqual({});
    expect(sqlSets('   ')).toEqual({});
  });

  it('should return empty object for non-string input', async () => {
    expect(sqlSets(123 as any)).toEqual({});
    expect(sqlSets({} as any)).toEqual({});
    expect(sqlSets([] as any)).toEqual({});
  });
});
