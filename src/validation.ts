import { resolve } from 'node:path'

/**
 * Validation patterns for SQL injection prevention and input validation.
 * These patterns ensure safe identifiers and clauses for ClickHouse queries.
 */
export const VALIDATION_PATTERNS = {
  /**
   * Database name: must start with letter/underscore, contain only alphanumeric and underscore, max 255 chars
   * @see https://clickhouse.com/docs/en/sql-reference/syntax#identifiers
   */
  DB_NAME: /^[a-zA-Z_][a-zA-Z0-9_]{0,254}$/,

  /**
   * Database engine: supports replication and clustering
   * Format: [ON CLUSTER <name>] ENGINE=<engine>[(params)] [COMMENT '<comment>']
   * Examples:
   *   - ENGINE = Atomic
   *   - ENGINE = Replicated()
   *   - ON CLUSTER '{cluster}' ENGINE = Replicated('/clickhouse/{installation}/{cluster}/databases/{database}', '{shard}', '{replica}')
   * @see https://clickhouse.com/docs/en/sql-reference/statements/create/database
   */
  DB_ENGINE:
    /^(ON\s+CLUSTER\s+['\w{}.,-]+\s+)?ENGINE\s*=\s*\w+(\s*\(\s*('[^']*'(\s*,\s*'[^']*')*\s*)?\))?(\s+COMMENT\s+'[^']*')?$/i,

  /**
   * Table engine: supports replicated MergeTree family engines
   * Format: EngineName[(params)]
   * Examples:
   *   - MergeTree
   *   - ReplicatedMergeTree()
   *   - ReplicatedMergeTree('/clickhouse/tables/{shard}/table_name', '{replica}')
   * @see https://clickhouse.com/docs/engines/table-engines/mergetree-family/replication
   */
  TABLE_ENGINE: /^[a-zA-Z]\w*(\s*\(\s*('[^']*'(\s*,\s*'[^']*')*\s*)?\))?$/,

  /**
   * Migration version: must be non-negative integer
   */
  VERSION_STRING: /^\d+$/,
} as const

/**
 * Validates a value against a regex pattern.
 * @param value - The value to validate
 * @param pattern - The regex pattern to match against
 * @param errorMsg - Error message to throw if validation fails
 * @returns The trimmed, validated value
 * @throws Error if validation fails
 */
export const validate = (value: string, pattern: RegExp, errorMsg: string): string => {
  const trimmed = value.trim()
  if (!trimmed || !pattern.test(trimmed)) {
    throw new Error(errorMsg)
  }
  return trimmed
}

/**
 * Validates database name for SQL injection prevention.
 * @param dbName - The database name to validate
 * @returns The validated database name
 * @throws Error if validation fails
 */
export const validateDbName = (dbName: string): string => {
  return validate(
    dbName,
    VALIDATION_PATTERNS.DB_NAME,
    'Invalid database name. Must start with a letter or underscore, contain only letters, numbers, and underscores, and be max 255 characters.',
  )
}

/**
 * Validates database engine clause for SQL injection prevention.
 * @param dbEngine - The database engine clause to validate
 * @returns The validated engine clause
 * @throws Error if validation fails
 */
export const validateDbEngine = (dbEngine: string): string => {
  return validate(
    dbEngine,
    VALIDATION_PATTERNS.DB_ENGINE,
    "Invalid db-engine parameter. Must match pattern: [ON CLUSTER <name>] ENGINE=<engine>[(params)] [COMMENT '<comment>']. Example: ON CLUSTER '{cluster}' ENGINE = Replicated('/clickhouse/{installation}/{cluster}/databases/{database}', '{shard}', '{replica}')",
  )
}

/**
 * Validates table engine clause for SQL injection prevention.
 * @param tableEngine - The table engine clause to validate
 * @returns The validated engine clause
 * @throws Error if validation fails
 */
export const validateTableEngine = (tableEngine: string): string => {
  return validate(
    tableEngine,
    VALIDATION_PATTERNS.TABLE_ENGINE,
    "Invalid table engine. Must match pattern: EngineName[(params)]. Example: ReplicatedMergeTree('/clickhouse/tables/{shard}/table_name', '{replica}')",
  )
}

/**
 * Validates table name (uses same rules as database name).
 * @param tableName - The table name to validate
 * @returns The validated table name
 * @throws Error if validation fails
 */
export const validateTableName = (tableName: string): string => {
  return validate(
    tableName,
    VALIDATION_PATTERNS.DB_NAME,
    'Invalid migration table name. Must start with a letter or underscore, contain only letters, numbers, and underscores, and be max 255 characters.',
  )
}

// System directories that should not be used as migrations home
const DANGEROUS_PATHS = ['/etc', '/sys', '/proc', '/dev', '/root', '/boot', '/bin', '/sbin', '/usr/bin', '/usr/sbin']

/**
 * Validates migrations directory path for security and correctness.
 * Resolves to absolute path and prevents path traversal attacks.
 *
 * @param path - The migrations directory path to validate
 * @returns The validated absolute path
 * @throws Error if path is invalid or points to system directories
 */
export const validateMigrationsHome = (path: string): string => {
  // Check for null, undefined, or non-string values
  if (!path || typeof path !== 'string') {
    throw new Error('Migrations directory path is required and must be a string')
  }

  const trimmed = path.trim()

  // Check for empty or whitespace-only strings
  if (!trimmed) {
    throw new Error('Migrations directory path cannot be empty or whitespace')
  }

  // Block null bytes (directory traversal/injection technique)
  if (trimmed.includes('\0')) {
    throw new Error('Invalid migrations directory path: null bytes are not allowed')
  }

  // Resolve to absolute path - this handles .. and . automatically
  const resolvedPath = resolve(trimmed)

  // Warn about potentially dangerous absolute paths to system directories
  const normalizedPath = resolvedPath.replace(/\\/g, '/').toLowerCase()

  for (const dangerousPath of DANGEROUS_PATHS) {
    if (normalizedPath === dangerousPath || normalizedPath.startsWith(`${dangerousPath}/`)) {
      throw new Error(
        `Invalid migrations directory path: operations on system directory '${dangerousPath}' are not allowed`,
      )
    }
  }

  // Check for Windows absolute paths to system directories
  if (/^[a-z]:\\(windows|system32|program files)/i.test(resolvedPath)) {
    throw new Error('Invalid migrations directory path: operations on Windows system directories are not allowed')
  }

  return resolvedPath
}

/**
 * Sanitizes error messages to prevent leaking sensitive information like passwords.
 * Removes potential credentials from URLs and connection strings.
 *
 * @param message - The error message to sanitize
 * @returns The sanitized error message with credentials redacted
 *
 * @example
 * ```typescript
 * sanitizeErrorMessage('Failed to connect to http://user:password@localhost')
 * // Returns: 'Failed to connect to http://user:[REDACTED]@localhost'
 * ```
 */
export const sanitizeErrorMessage = (message: string): string => {
  // Remove passwords from URLs (http://user:password@host -> http://user:[REDACTED]@host)
  let sanitized = message.replace(/((?:https?|clickhouse):\/\/[^:/@\s]+:)([^@\s]+)(@)/gi, '$1[REDACTED]$3')

  // Remove passwords from connection strings (password=xxx, password='xxx', password: xxx)
  sanitized = sanitized.replace(/(password\s*[:=]\s*['"]?)([^'",\s}]+)(['"]?)/gi, '$1[REDACTED]$3')

  // Remove authorization headers
  sanitized = sanitized.replace(/(authorization\s*[:=]\s*)(['"]?)([^\s'",}]+)(['"]?)/gi, '$1$2[REDACTED]$4')

  // Remove basic auth tokens
  sanitized = sanitized.replace(/(basic\s+)([a-zA-Z0-9+/]+=*)/gi, '$1[REDACTED]')

  return sanitized
}

/**
 * Type guard for query errors.
 */
export const isQueryError = (error: unknown): error is { message: string } => {
  return typeof error === 'object' && error !== null && 'message' in error
}

/**
 * Extracts error message from unknown error type.
 */
export const getErrorMessage = (error: unknown): string => {
  return isQueryError(error) ? error.message : String(error)
}
