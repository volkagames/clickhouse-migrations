// Remove SQL comments from content
// Supports: -- single line, # single line, #! shebang
const removeComments = (content: string): string => {
  return content.replace(/(--|#!|#\s?).*(\n|\r\n|\r|$)/gm, '\n');
};

// Extract sql queries from migrations.
const sql_queries = (content: string): string[] => {
  const queries = removeComments(content)
    .replace(/^\s*(SET\s).*(\n|\r\n|\r|$)/gm, '')
    .replace(/(\n|\r\n|\r)/gm, ' ')
    .replace(/\s+/g, ' ')
    .split(';')
    .map((el: string) => el.trim())
    .filter((el: string) => el.length !== 0);

  return queries;
};

// Extract query settings from migrations.
const sql_sets = (content: string) => {
  const sets: { [key: string]: string | number } = {};

  const sets_arr = removeComments(content)
    .replace(/^\s*(?!SET\s).*(\n|\r\n|\r|$)/gm, '')
    .replace(/^\s*(SET\s)/gm, '')
    .replace(/(\n|\r\n|\r)/gm, ' ')
    .replace(/\s+/g, '')
    .split(';');

  sets_arr.forEach((set_full) => {
    const trimmed = set_full.trim();
    if (!trimmed) {
      return;
    }

    // Split only on first '=' to handle values containing '='
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
      // SET without value - skip or warn
      return;
    }

    const key = trimmed.substring(0, equalIndex).trim();
    const value = trimmed.substring(equalIndex + 1).trim();

    if (key && value) {
      // Remove quotes if present and store the value
      const unquotedValue = value.replace(/^['"](.*)['"]$/, '$1');
      sets[key] = unquotedValue;
    }
  });

  return sets;
};

export { sql_queries, sql_sets };
