const COLORS = {
  CYAN: '\x1b[36m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  RESET: '\x1b[0m',
} as const

export type LogLevel = 'info' | 'error' | 'warn' | 'success'

// Structured logging severity levels
export type Severity =
  | 'DEFAULT'
  | 'DEBUG'
  | 'INFO'
  | 'NOTICE'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL'
  | 'ALERT'
  | 'EMERGENCY'

export type LogFormat = 'console' | 'json'

// Minimum log level filter
export type MinLogLevel = 'debug' | 'info' | 'warn' | 'error'

// Severity hierarchy for filtering
const SEVERITY_LEVELS: Record<MinLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export interface LoggerOptions {
  format?: LogFormat
  prefix?: string
  minLevel?: MinLogLevel
}

export interface Logger {
  info: (message: string) => void
  error: (message: string, details?: string) => void
  warn: (message: string) => void
  success: (message: string) => void
  log: (message: string) => void
}

class ConsoleLogger implements Logger {
  private prefix: string
  private minLevel: number

  constructor(prefix = 'clickhouse-migrations', minLevel: MinLogLevel = 'info') {
    this.prefix = prefix
    this.minLevel = SEVERITY_LEVELS[minLevel]
  }

  private shouldLog(level: MinLogLevel): boolean {
    return SEVERITY_LEVELS[level] >= this.minLevel
  }

  info(message: string): void {
    if (this.shouldLog('info')) {
      console.log(COLORS.CYAN, `${this.prefix} :`, COLORS.RESET, message)
    }
  }

  error(message: string, details?: string): void {
    if (this.shouldLog('error')) {
      console.error(COLORS.CYAN, `${this.prefix} :`, COLORS.RED, `Error: ${message}`, details ? `\n\n ${details}` : '')
    }
  }

  warn(message: string): void {
    if (this.shouldLog('warn')) {
      console.log(COLORS.YELLOW, `  Warning: ${message}`, COLORS.RESET)
    }
  }

  success(message: string): void {
    if (this.shouldLog('info')) {
      console.log(`${COLORS.GREEN}✓ ${COLORS.RESET}${message}`)
    }
  }

  log(message: string): void {
    if (this.shouldLog('debug')) {
      console.log(message)
    }
  }
}

class JsonLogger implements Logger {
  private prefix: string
  private minLevel: number

  constructor(prefix = 'clickhouse-migrations', minLevel: MinLogLevel = 'info') {
    this.prefix = prefix
    this.minLevel = SEVERITY_LEVELS[minLevel]
  }

  private shouldLog(level: MinLogLevel): boolean {
    return SEVERITY_LEVELS[level] >= this.minLevel
  }

  private formatLog(severity: Severity, message: string, details?: string): void {
    const logEntry = {
      severity,
      message,
      timestamp: new Date().toISOString(),
      component: this.prefix,
      ...(details && { details }),
    }
    console.log(JSON.stringify(logEntry))
  }

  info(message: string): void {
    if (this.shouldLog('info')) {
      this.formatLog('INFO', message)
    }
  }

  error(message: string, details?: string): void {
    if (this.shouldLog('error')) {
      this.formatLog('ERROR', message, details)
    }
  }

  warn(message: string): void {
    if (this.shouldLog('warn')) {
      this.formatLog('WARNING', message)
    }
  }

  success(message: string): void {
    if (this.shouldLog('info')) {
      this.formatLog('NOTICE', message)
    }
  }

  log(message: string): void {
    if (this.shouldLog('debug')) {
      this.formatLog('DEFAULT', message)
    }
  }
}

// Default logger instance
let currentLogger: Logger = new ConsoleLogger()

// Factory function to create a logger based on options
export const createLogger = (options: LoggerOptions = {}): Logger => {
  const { format = 'console', prefix, minLevel } = options

  if (format === 'json') {
    return new JsonLogger(prefix, minLevel)
  }

  return new ConsoleLogger(prefix, minLevel)
}

// Get the current logger instance
export const getLogger = (): Logger => currentLogger

// Set a custom logger (useful for testing)
export const setLogger = (logger: Logger): void => {
  currentLogger = logger
}

// Configure logger with options
export const configureLogger = (options: LoggerOptions = {}): void => {
  currentLogger = createLogger(options)
}

// Reset to default console logger
export const resetLogger = (): void => {
  currentLogger = new ConsoleLogger()
}

// Export COLORS for backward compatibility with displayMigrationStatus
export { COLORS }
