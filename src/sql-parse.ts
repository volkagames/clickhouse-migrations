// Remove SQL comments from content
// Supports: -- single line, # single line, #! shebang, /* */ block comments
// Also supports inline comments: SELECT * FROM table -- comment
// Preserves string literals correctly
const isQuoteChar = (ch: string) => ch === "'" || ch === '"';

// Remove /* ... */ block comments while preserving string literals
const removeBlockComments = (content: string): string => {
  let result = '';
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inString) {
      // Handle escaping inside string
      if (ch === '\\' && !escaped) {
        escaped = true;
        result += ch;
        continue;
      }
      if (ch === stringChar && !escaped) {
        inString = false;
        stringChar = '';
      }
      escaped = false;
      result += ch;
      continue;
    }

    // Not in string
    if (isQuoteChar(ch)) {
      inString = true;
      stringChar = ch;
      result += ch;
      continue;
    }

    // Start of block comment
    if (ch === '/' && next === '*') {
      // find end of block comment
      let j = i + 2;
      let foundEnd = false;
      while (j < content.length - 1) {
        if (content[j] === '*' && content[j + 1] === '/') {
          i = j + 1; // loop increment will move past '/'
          foundEnd = true;
          break;
        }
        j++;
      }
      if (!foundEnd) {
        // Unterminated block comment: stop processing further
        break;
      }
      continue;
    }

    result += ch;
  }

  return result;
};

// Remove inline comments (-- and #) from each line while preserving string literals.
// Lines that start with # (after optional whitespace) are treated as whole-line comments.
// Shebang (#!) is considered a comment as well.
const removeLineComments = (content: string): string => {
  const lines = content.split(/\r?\n/);
  return lines
    .map((line) => {
      let inString = false;
      let stringChar = '';
      let escaped = false;
      let out = '';

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = line[i + 1];

        if (inString) {
          if (ch === '\\' && !escaped) {
            escaped = true;
            out += ch;
            continue;
          }
          if (ch === stringChar && !escaped) {
            inString = false;
            stringChar = '';
          }
          escaped = false;
          out += ch;
          continue;
        }

        // Not in string
        if (isQuoteChar(ch)) {
          inString = true;
          stringChar = ch;
          out += ch;
          continue;
        }

        // -- comment starts: rest of line is comment
        if (ch === '-' && next === '-') {
          break;
        }

        // # comment at line start (after optional whitespace)
        if (ch === '#' && out.trim() === '') {
          break;
        }

        out += ch;
      }

      return out;
    })
    .join('\n');
};

const removeComments = (content: string): string => {
  // First remove block comments, then inline line comments
  const withoutBlocks = removeBlockComments(content);
  return removeLineComments(withoutBlocks);
};

// Extract sql queries from migrations.
const sql_queries = (content: string): string[] => {
  const cleaned = removeComments(content)
    .replace(/^\s*(SET\s).*(\n|\r\n|\r|$)/gm, '') // remove SET lines
    .replace(/(\r\n|\n|\r)/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  return cleaned
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

// Extract query settings from migrations.
const sql_sets = (content: string) => {
  const sets: { [key: string]: string | number } = {};

  const cleaned = removeComments(content)
    .replace(/^\s*(?!SET\s).*(\n|\r\n|\r|$)/gm, '') // keep only SET lines
    .replace(/^\s*(SET\s)/gm, '')
    .replace(/(\r\n|\n|\r)/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return sets;

  const parts = cleaned.split(';').map((p) => p.trim()).filter(Boolean);

  parts.forEach((part) => {
    const eq = part.indexOf('=');
    if (eq === -1) return;
    const key = part.substring(0, eq).trim();
    let value = part.substring(eq + 1).trim();
    if (!key) return;
    // remove surrounding quotes if present
    value = value.replace(/^['"](.*)['"]$/, '$1');
    sets[key] = value;
  });

  return sets;
};

export { sql_queries, sql_sets };
