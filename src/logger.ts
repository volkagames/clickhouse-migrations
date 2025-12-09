// Log levels (lower = more verbose)
export const levels = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
  silent: Number.POSITIVE_INFINITY,
} as const

export type Level = keyof typeof levels

// ANSI colors for console output
const COLORS = {
  CYAN: '\x1b[36m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  MAGENTA: '\x1b[35m',
  RESET: '\x1b[0m',
} as const

// Color mapping for log levels
const LEVEL_COLORS: Record<Level, string> = {
  fatal: COLORS.RED,
  error: COLORS.RED,
  warn: COLORS.YELLOW,
  info: COLORS.CYAN,
  debug: COLORS.MAGENTA,
  trace: COLORS.MAGENTA,
  silent: COLORS.RESET,
}

export interface LoggerOptions {
  /** Logger name (adds `name` field to JSON output) */
  name?: string
  /** Minimum log level (default: 'info') */
  level?: Level
  /** Base object properties to include in every log line */
  base?: Record<string, unknown>
  /** Key for the message field in JSON output (default: 'msg') */
  messageKey?: string
  /** Include timestamp (default: true) */
  timestamp?: boolean | (() => string | undefined)
  /** Output format: 'json' for structured logs, 'pretty' for human-readable */
  format?: 'json' | 'pretty'
}

export interface LogFn {
  (msg: string): void
  (obj: Record<string, unknown>, msg?: string): void
  <T extends Record<string, unknown>>(obj: T, msg?: string): void
}

export interface ILogger {
  level: Level
  fatal: LogFn
  error: LogFn
  warn: LogFn
  info: LogFn
  debug: LogFn
  trace: LogFn
  silent: LogFn
  child(bindings: Record<string, unknown>): ILogger
  bindings(): Record<string, unknown>
}

class Logger implements ILogger {
  private _level: Level
  private _levelValue: number
  private _bindings: Record<string, unknown>
  private _base: Record<string, unknown>
  private _messageKey: string
  private _timestamp: boolean | (() => string | undefined)
  private _format: 'json' | 'pretty'
  private _name?: string

  constructor(options: LoggerOptions = {}, bindings: Record<string, unknown> = {}) {
    this._level = options.level ?? 'info'
    this._levelValue = levels[this._level]
    this._bindings = bindings
    this._base = options.base ?? {}
    this._messageKey = options.messageKey ?? 'message'
    this._timestamp = options.timestamp ?? true
    this._format = options.format ?? 'json'
    this._name = options.name
  }

  get level(): Level {
    return this._level
  }

  set level(newLevel: Level) {
    this._level = newLevel
    this._levelValue = levels[newLevel]
  }

  bindings(): Record<string, unknown> {
    return { ...this._bindings }
  }

  child(bindings: Record<string, unknown>): ILogger {
    const childLogger = new Logger(
      {
        level: this._level,
        base: this._base,
        messageKey: this._messageKey,
        timestamp: this._timestamp,
        format: this._format,
        name: this._name,
      },
      { ...this._bindings, ...bindings },
    )
    return childLogger
  }

  private shouldLog(level: Level): boolean {
    return levels[level] >= this._levelValue
  }

  private getTimestamp(): string | undefined {
    if (this._timestamp === false) {
      return undefined
    }
    if (typeof this._timestamp === 'function') {
      return this._timestamp()
    }
    return new Date().toISOString()
  }

  private log(level: Level, objOrMsg: Record<string, unknown> | string, msg?: string): void {
    if (!this.shouldLog(level)) {
      return
    }

    let mergeObj: Record<string, unknown> = {}
    let message: string

    if (typeof objOrMsg === 'string') {
      message = objOrMsg
    } else {
      mergeObj = objOrMsg
      message = msg ?? ''
    }

    if (this._format === 'pretty') {
      this.logPretty(level, mergeObj, message)
    } else {
      this.logJson(level, mergeObj, message)
    }
  }

  private logJson(level: Level, mergeObj: Record<string, unknown>, message: string): void {
    const timestamp = this.getTimestamp()
    const logEntry: Record<string, unknown> = {
      severity: level.toUpperCase(),
      ...(timestamp !== undefined && { timestamp }),
      ...this._base,
      ...(this._name && { name: this._name }),
      ...this._bindings,
      ...mergeObj,
      [this._messageKey]: message,
    }

    const output = JSON.stringify(logEntry)

    if (level === 'error' || level === 'fatal') {
      console.error(output)
    } else {
      console.log(output)
    }
  }

  private logPretty(level: Level, mergeObj: Record<string, unknown>, message: string): void {
    const color = LEVEL_COLORS[level]
    const timestamp = new Date().toISOString()
    const name = this._name ? `${this._name} ` : ''
    const bindingsStr = Object.keys(this._bindings).length > 0 ? ` ${JSON.stringify(this._bindings)}` : ''
    const mergeStr = Object.keys(mergeObj).length > 0 ? ` ${JSON.stringify(mergeObj)}` : ''

    const levelLabel = level.toUpperCase().padEnd(5)
    const output = `${COLORS.CYAN}[${timestamp}]${COLORS.RESET} ${color}${levelLabel}${COLORS.RESET} ${name}${message}${bindingsStr}${mergeStr}`

    if (level === 'error' || level === 'fatal') {
      console.error(output)
    } else {
      console.log(output)
    }
  }

  fatal: LogFn = (objOrMsg: Record<string, unknown> | string, msg?: string): void => {
    this.log('fatal', objOrMsg, msg)
  }

  error: LogFn = (objOrMsg: Record<string, unknown> | string, msg?: string): void => {
    this.log('error', objOrMsg, msg)
  }

  warn: LogFn = (objOrMsg: Record<string, unknown> | string, msg?: string): void => {
    this.log('warn', objOrMsg, msg)
  }

  info: LogFn = (objOrMsg: Record<string, unknown> | string, msg?: string): void => {
    this.log('info', objOrMsg, msg)
  }

  debug: LogFn = (objOrMsg: Record<string, unknown> | string, msg?: string): void => {
    this.log('debug', objOrMsg, msg)
  }

  trace: LogFn = (objOrMsg: Record<string, unknown> | string, msg?: string): void => {
    this.log('trace', objOrMsg, msg)
  }

  silent: LogFn = (_objOrMsg: Record<string, unknown> | string, _msg?: string): void => {
    // No-op for silent level
  }
}

/**
 * Creates a logger instance.
 *
 * @example
 * ```ts
 * // JSON logger (default)
 * const logger = createLogger()
 * logger.info('hello world')
 * // Output: {"severity":"INFO","timestamp":"2025-12-09T12:34:56.789Z","message":"hello world"}
 *
 * // With name and custom level
 * const logger = createLogger({ name: 'my-app', level: 'debug' })
 * logger.debug({ userId: 123 }, 'user logged in')
 *
 * // Pretty output for development
 * const logger = createLogger({ transport: 'pretty' })
 *
 * // Child logger with context
 * const child = logger.child({ requestId: 'abc-123' })
 * child.info('processing request')
 * ```
 */
export const createLogger = (options: LoggerOptions = {}): ILogger => {
  return new Logger(options)
}

export default createLogger

// Export COLORS for backward compatibility with displayMigrationStatus
export { COLORS }
