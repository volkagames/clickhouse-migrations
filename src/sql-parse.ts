// SQL parser: removes comments while preserving string literals

// Object pool pattern: reuses parser instances to avoid GC pressure
class ParserStack {
  private stack: SqlParser[] = [];
  private maxSize = 10;

  acquire(): SqlParser {
    const parser = this.stack.pop() || new SqlParser();
    parser.reset();
    return parser;
  }

  release(parser: SqlParser): void {
    if (this.stack.length < this.maxSize) {
      this.stack.push(parser);
    }
  }
}

const parserStack = new ParserStack();

// Tracks string literal boundaries to avoid treating quote content as SQL syntax
class SqlParser {
  private inString = false;
  private stringChar = '';
  private escaped = false;
  private content = '';
  private index = 0;

  reset(): void {
    this.inString = false;
    this.stringChar = '';
    this.escaped = false;
    this.content = '';
    this.index = 0;
  }

  processChar(ch: string, content: string, index: number): boolean {
    this.content = content;
    this.index = index;
    if (this.inString) {
      if (this.escaped) {
        this.escaped = false;
      } else if (ch === '\\') {
        this.escaped = true;
      } else if (ch === this.stringChar) {
        // Handle SQL doubled quote escape: '' or ""
        const nextChar = this.content[this.index + 1];
        if (nextChar === this.stringChar) {
          this.escaped = true;
        } else {
          this.inString = false;
          this.stringChar = '';
        }
      }
      return true;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      this.inString = true;
      this.stringChar = ch;
      return true;
    }

    return false;
  }

  isInString(): boolean {
    return this.inString;
  }
}

// Removes /* */ block comments while preserving string literals
const removeBlockComments = (content: string): string => {
  const parser = parserStack.acquire();
  let result = '';

  try {
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (char === undefined) continue;
      const inString = parser.processChar(char, content, i);

      if (inString) {
        result += char;
        continue;
      }

      if (char === '/' && content[i + 1] === '*') {
        let j = i + 2;
        const commentParser = parserStack.acquire();

        try {
          while (j < content.length) {
            const jChar = content[j];
            if (jChar === undefined) break;
            commentParser.processChar(jChar, content, j);

            if (!commentParser.isInString() && jChar === '*' && content[j + 1] === '/') {
              i = j + 1;
              break;
            }
            j++;
          }

          if (j >= content.length) {
            break; // Unterminated comment
          }
        } finally {
          parserStack.release(commentParser);
        }
        continue;
      }

      result += char;
    }

    return result;
  } finally {
    parserStack.release(parser);
  }
};

// Removes -- and # line comments (SQL/shell style) while preserving string literals
const removeLineComments = (content: string): string => {
  const parser = parserStack.acquire();

  try {
    return content
      .split(/\r?\n/)
      .map((line) => {
        parser.reset();
        let result = '';

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === undefined) continue;
          const inString = parser.processChar(char, line, i);

          if (inString) {
            result += char;
            continue;
          }

          if (char === '-' && line[i + 1] === '-') break;

          // # only valid at line start (shell-style comment)
          if (char === '#' && result.trim() === '') break;

          result += char;
        }

        if (parser.isInString()) {
          throw new Error('Unterminated string literal in SQL');
        }

        return result;
      })
      .join('\n');
  } finally {
    parserStack.release(parser);
  }
};

// Splits SQL by delimiter (e.g., ';') while respecting string literal boundaries
const splitByDelimiter = (content: string, delimiter: string): string[] => {
  const parser = parserStack.acquire();
  const parts: string[] = [];
  let current = '';

  try {
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (char === undefined) continue;
      const inString = parser.processChar(char, content, i);

      if (inString) {
        current += char;
        continue;
      }

      if (char === delimiter) {
        const trimmed = current.trim();
        if (trimmed) parts.push(trimmed);
        current = '';
        continue;
      }

      current += char;
    }

    const trimmed = current.trim();
    if (trimmed) parts.push(trimmed);

    if (parser.isInString()) {
      throw new Error('Unterminated string literal in SQL');
    }

    return parts;
  } finally {
    parserStack.release(parser);
  }
};

// Extracts executable SQL queries (excludes SET statements)
const sqlQueries = (content: string): string[] => {
  if (!content || typeof content !== 'string') return [];

  const cleaned = removeLineComments(removeBlockComments(content))
    .replace(/^\s*SET\s.*(\n|\r\n|\r|$)/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned ? splitByDelimiter(cleaned, ';') : [];
};

// Extracts SET statements and returns as key-value pairs (e.g., SET foo=bar → {foo: 'bar'})
const sqlSets = (content: string): Record<string, string> => {
  if (!content || typeof content !== 'string') return {};

  const sets: Record<string, string> = {};

  const withoutComments = removeLineComments(removeBlockComments(content));
  const setStatements: string[] = [];

  const SET_PREFIX = 'SET ';
  withoutComments.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.toUpperCase().startsWith(SET_PREFIX)) {
      setStatements.push(trimmed.substring(SET_PREFIX.length));
    }
  });

  if (setStatements.length === 0) return sets;

  const parser = parserStack.acquire();
  try {
    splitByDelimiter(setStatements.join(' '), ';').forEach((part) => {
      parser.reset();
      let eqIndex = -1;

      for (let i = 0; i < part.length; i++) {
        const char = part[i];
        if (char === undefined) continue;
        const inString = parser.processChar(char, part, i);

        if (!inString && char === '=') {
          eqIndex = i;
          break;
        }
      }

      if (eqIndex === -1) return;

      const key = part.substring(0, eqIndex).trim();
      let value = part.substring(eqIndex + 1).trim();

      if (!key) return;

      // Strip surrounding quotes if present
      const firstChar = value[0];
      const lastChar = value[value.length - 1];
      if (
        value.length >= 2 &&
        firstChar !== undefined &&
        lastChar !== undefined &&
        ((firstChar === '"' && lastChar === '"') || (firstChar === "'" && lastChar === "'"))
      ) {
        value = value.slice(1, -1);
      }

      sets[key] = value;
    });
  } finally {
    parserStack.release(parser);
  }

  return sets;
};

export { sqlQueries, sqlQueries as sql_queries, sqlSets, sqlSets as sql_sets };
