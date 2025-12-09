import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { COLORS, createLogger, levels } from '../src/logger'
import { cleanupTest, setupConsoleSpy } from './helpers/testSetup'

describe('Logger Module', () => {
  let consoleSpy: ReturnType<typeof setupConsoleSpy>

  beforeEach(() => {
    consoleSpy = setupConsoleSpy()
  })

  afterEach(() => {
    consoleSpy.restore()
    cleanupTest()
  })

  describe('createLogger()', () => {
    describe('JSON output (default)', () => {
      it('should output JSON with structured format', () => {
        const logger = createLogger({ name: 'test-app', base: {} })
        logger.info('hello world')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)
        const output = consoleSpy.consoleLogSpy.mock.calls[0]?.[0]
        const parsed = JSON.parse(output)

        expect(parsed).toMatchObject({
          severity: 'INFO',
          message: 'hello world',
          name: 'test-app',
        })
        expect(parsed.timestamp).toBeDefined()
      })

      it('should use numeric log levels', () => {
        expect(levels.trace).toBe(10)
        expect(levels.debug).toBe(20)
        expect(levels.info).toBe(30)
        expect(levels.warn).toBe(40)
        expect(levels.error).toBe(50)
        expect(levels.fatal).toBe(60)
      })

      it('should include merge object properties', () => {
        const logger = createLogger({ base: {} })
        logger.info({ userId: 123, action: 'login' }, 'user logged in')

        const output = consoleSpy.consoleLogSpy.mock.calls[0]?.[0]
        const parsed = JSON.parse(output)

        expect(parsed).toMatchObject({
          severity: 'INFO',
          userId: 123,
          action: 'login',
          message: 'user logged in',
        })
      })

      it('should support all log methods', () => {
        const logger = createLogger({ level: 'trace', base: {} })

        logger.trace('trace message')
        logger.debug('debug message')
        logger.info('info message')
        logger.warn('warn message')
        logger.error('error message')
        logger.fatal('fatal message')

        // trace, debug, info, warn go to console.log
        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(4)
        // error, fatal go to console.error
        expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledTimes(2)
      })
    })

    describe('child loggers', () => {
      it('should create child logger with bindings', () => {
        const logger = createLogger({ name: 'app', base: {} })
        const child = logger.child({ requestId: 'abc-123' })

        child.info('processing request')

        const output = consoleSpy.consoleLogSpy.mock.calls[0]?.[0]
        const parsed = JSON.parse(output)

        expect(parsed).toMatchObject({
          severity: 'INFO',
          requestId: 'abc-123',
          message: 'processing request',
        })
      })

      it('should inherit parent configuration', () => {
        const logger = createLogger({ name: 'app', level: 'warn', base: {} })
        const child = logger.child({ component: 'db' })

        child.info('should not appear')
        child.warn('should appear')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)
      })

      it('should return bindings via bindings() method', () => {
        const logger = createLogger()
        const child = logger.child({ requestId: 'xyz', userId: 42 })

        expect(child.bindings()).toEqual({ requestId: 'xyz', userId: 42 })
      })

      it('should merge child bindings with parent bindings', () => {
        const logger = createLogger({ base: {} })
        const child1 = logger.child({ service: 'api' })
        const child2 = child1.child({ requestId: '123' })

        child2.info('nested child')

        const output = consoleSpy.consoleLogSpy.mock.calls[0]?.[0]
        const parsed = JSON.parse(output)

        expect(parsed).toMatchObject({
          service: 'api',
          requestId: '123',
        })
      })
    })

    describe('log level filtering', () => {
      it('should filter logs below minimum level', () => {
        const logger = createLogger({ level: 'warn', base: {} })

        logger.trace('no')
        logger.debug('no')
        logger.info('no')
        logger.warn('yes')
        logger.error('yes')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)
        expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledTimes(1)
      })

      it('should allow changing level at runtime', () => {
        const logger = createLogger({ level: 'error', base: {} })

        logger.info('should not appear')
        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(0)

        logger.level = 'info'
        logger.info('should appear now')
        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)
      })
    })

    describe('pretty transport', () => {
      it('should output human-readable format', () => {
        const logger = createLogger({ format: 'pretty', name: 'my-app' })
        logger.info('hello')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)
        const output = consoleSpy.consoleLogSpy.mock.calls[0]?.[0]

        // Should contain timestamp, level, name, and message
        expect(output).toContain('INFO')
        expect(output).toContain('my-app')
        expect(output).toContain('hello')
      })

      it('should include bindings in pretty output', () => {
        const logger = createLogger({ format: 'pretty' })
        const child = logger.child({ requestId: 'test-123' })
        child.info('request processed')

        const output = consoleSpy.consoleLogSpy.mock.calls[0]?.[0]
        expect(output).toContain('requestId')
        expect(output).toContain('test-123')
      })
    })

    describe('timestamp options', () => {
      it('should include timestamp by default', () => {
        const logger = createLogger({ base: {} })
        logger.info('test')

        const output = consoleSpy.consoleLogSpy.mock.calls[0]?.[0]
        const parsed = JSON.parse(output)
        expect(parsed.timestamp).toBeDefined()
      })

      it('should allow disabling timestamp', () => {
        const logger = createLogger({ timestamp: false, base: {} })
        logger.info('test')

        const output = consoleSpy.consoleLogSpy.mock.calls[0]?.[0]
        const parsed = JSON.parse(output)
        expect(parsed.timestamp).toBeUndefined()
      })

      it('should support custom timestamp function', () => {
        const logger = createLogger({ timestamp: () => 'custom-time', base: {} })
        logger.info('test')

        const output = consoleSpy.consoleLogSpy.mock.calls[0]?.[0]
        const parsed = JSON.parse(output)
        expect(parsed.timestamp).toBe('custom-time')
      })
    })

    describe('default options', () => {
      it('should create JSON logger by default', () => {
        const logger = createLogger({ base: {} })
        logger.info('test message')

        const output = consoleSpy.consoleLogSpy.mock.calls[0]?.[0]
        const parsed = JSON.parse(output)
        expect(parsed.severity).toBe('INFO')
        expect(parsed.message).toBe('test message')
      })

      it('should use info as default minimum level', () => {
        const logger = createLogger({ base: {} })

        logger.debug('debug - should not appear')
        logger.info('info - should appear')
        logger.warn('warn - should appear')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('COLORS export', () => {
    it('should export ANSI color codes', () => {
      expect(COLORS.CYAN).toBe('\x1b[36m')
      expect(COLORS.GREEN).toBe('\x1b[32m')
      expect(COLORS.YELLOW).toBe('\x1b[33m')
      expect(COLORS.RED).toBe('\x1b[31m')
      expect(COLORS.RESET).toBe('\x1b[0m')
    })
  })
})
