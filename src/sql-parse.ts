// SQL Parser - string-aware comment removal and query extraction

// Stack-based parser pool to handle nested calls safely
class ParserStack {
  private stack: SqlParser[] = [];
  private maxSize = 10; // Reasonable limit for nested calls

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

// Parser tracks string literal state to avoid parsing content inside quotes
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
        // Handle doubled quote escape: '' or ""
        const nextChar = this.content[this.index + 1];
        if (nextChar === this.stringChar) {
          // This is the first quote of a doubled pair, skip it
          this.escaped = true;
        } else {
          // End of string
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

// Remove /* */ block comments while preserving strings
const removeBlockComments = (content: string): string => {
  const parser = parserStack.acquire();
  let result = '';

  try {
    for (let i = 0; i < content.length; i++) {
      const inString = parser.processChar(content[i], content, i);

      if (inString) {
        result += content[i];
        continue;
      }

      // Check for /* start (only outside strings)
      if (content[i] === '/' && content[i + 1] === '*') {
        // Find */ end, but track if we enter a string inside the comment
        let j = i + 2;
        const commentParser = parserStack.acquire();

        try {
          while (j < content.length) {
            commentParser.processChar(content[j], content, j);

            // Check for */ only outside strings
            if (!commentParser.isInString() && content[j] === '*' && content[j + 1] === '/') {
              i = j + 1; // Skip past */
              break;
            }
            j++;
          }

          // If we reached end without finding */, it's unterminated
          if (j >= content.length) {
            break; // Unterminated comment
          }
        } finally {
          parserStack.release(commentParser);
        }
        continue;
      }

      result += content[i];
    }

    return result;
  } finally {
    parserStack.release(parser);
  }
};

// Remove -- and # line comments while preserving strings
const removeLineComments = (content: string): string => {
  const parser = parserStack.acquire();

  try {
    return content
      .split(/\r?\n/)
      .map((line) => {
        parser.reset();
        let result = '';

        for (let i = 0; i < line.length; i++) {
          const inString = parser.processChar(line[i], line, i);

          if (inString) {
            result += line[i];
            continue;
          }

          // Check for -- comment
          if (line[i] === '-' && line[i + 1] === '-') break;

          // Check for # at line start (after whitespace only)
          if (line[i] === '#' && result.trim() === '') break;

          result += line[i];
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

// Split string by delimiter while respecting string literals
const splitByDelimiter = (content: string, delimiter: string): string[] => {
  const parser = parserStack.acquire();
  const parts: string[] = [];
  let current = '';

  try {
    for (let i = 0; i < content.length; i++) {
      const inString = parser.processChar(content[i], content, i);

      if (inString) {
        current += content[i];
        continue;
      }

      if (content[i] === delimiter) {
        const trimmed = current.trim();
        if (trimmed) parts.push(trimmed);
        current = '';
        continue;
      }

      current += content[i];
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

// Extract SQL queries from migration content
const sqlQueries = (content: string): string[] => {
  if (!content || typeof content !== 'string') return [];

  // Remove comments
  const cleaned = removeLineComments(removeBlockComments(content))
    .replace(/^\s*SET\s.*(\n|\r\n|\r|$)/gm, '') // remove SET lines
    .replace(/\s+/g, ' ') // This also replaces newlines, so no need for separate newline replacement
    .trim();

  return cleaned ? splitByDelimiter(cleaned, ';') : [];
};

// Extract SET statements from migration content
const sqlSets = (content: string): Record<string, string> => {
  if (!content || typeof content !== 'string') return {};

  const sets: Record<string, string> = {};

  // Remove comments and extract SET lines
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

  // Parse each SET statement
  const parser = parserStack.acquire();
  try {
    splitByDelimiter(setStatements.join(' '), ';').forEach((part) => {
      // Find = sign outside strings
      parser.reset();
      let eqIndex = -1;

      for (let i = 0; i < part.length; i++) {
        const inString = parser.processChar(part[i], part, i);

        if (!inString && part[i] === '=') {
          eqIndex = i;
          break;
        }
      }

      if (eqIndex === -1) return;

      const key = part.substring(0, eqIndex).trim();
      let value = part.substring(eqIndex + 1).trim();

      if (!key) return;

      // Remove matching surrounding quotes
      if (
        value.length >= 2 &&
        ((value[0] === '"' && value[value.length - 1] === '"') || (value[0] === "'" && value[value.length - 1] === "'"))
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
