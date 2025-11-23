import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COLORS, configureLogger, createLogger, getLogger, type Logger, resetLogger, setLogger } from '../src/logger'
import { cleanupTest, setupConsoleSpy } from './helpers/testSetup'

describe('Logger Module', () => {
  let consoleSpy: ReturnType<typeof setupConsoleSpy>

  beforeEach(() => {
    // Reset logger before each test
    resetLogger()
    consoleSpy = setupConsoleSpy()
  })

  afterEach(() => {
    consoleSpy.restore()
    cleanupTest()
    resetLogger()
  })

  describe('ConsoleLogger (default logger)', () => {
    describe('info()', () => {
      it('should log info messages with cyan color and prefix', () => {
        const logger = getLogger()
        logger.info('Test info message')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(
          COLORS.CYAN,
          'clickhouse-migrations :',
          COLORS.RESET,
          'Test info message',
        )
      })

      it('should handle multiline messages', () => {
        const logger = getLogger()
        const message = 'Line 1\nLine 2\nLine 3'
        logger.info(message)

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(
          COLORS.CYAN,
          'clickhouse-migrations :',
          COLORS.RESET,
          message,
        )
      })
    })

    describe('error()', () => {
      it('should log error messages with red color and Error prefix', () => {
        const logger = getLogger()
        logger.error('Test error message')

        expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledWith(
          COLORS.CYAN,
          'clickhouse-migrations :',
          COLORS.RED,
          'Error: Test error message',
          '',
        )
      })

      it('should include error details when provided', () => {
        const logger = getLogger()
        logger.error('Test error message', 'Additional error details')

        expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledWith(
          COLORS.CYAN,
          'clickhouse-migrations :',
          COLORS.RED,
          'Error: Test error message',
          '\n\n Additional error details',
        )
      })

      it('should handle multiline error details', () => {
        const logger = getLogger()
        const details = 'Error line 1\nError line 2'
        logger.error('Error occurred', details)

        expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledWith(
          COLORS.CYAN,
          'clickhouse-migrations :',
          COLORS.RED,
          'Error: Error occurred',
          `\n\n ${details}`,
        )
      })
    })

    describe('warn()', () => {
      it('should log warning messages with yellow color', () => {
        const logger = getLogger()
        logger.warn('Test warning message')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(
          COLORS.YELLOW,
          '  Warning: Test warning message',
          COLORS.RESET,
        )
      })
    })

    describe('success()', () => {
      it('should log success messages with green checkmark', () => {
        const logger = getLogger()
        logger.success('Operation completed')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(`${COLORS.GREEN}✓ ${COLORS.RESET}Operation completed`)
      })
    })

    describe('log()', () => {
      it('should log plain messages without formatting when minLevel is debug', () => {
        configureLogger({ format: 'console', minLevel: 'debug' })
        const logger = getLogger()
        logger.log('Plain log message')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith('Plain log message')
      })

      it('should preserve color codes in message when minLevel is debug', () => {
        configureLogger({ format: 'console', minLevel: 'debug' })
        const logger = getLogger()
        const coloredMessage = `${COLORS.GREEN}Colored${COLORS.RESET} message`
        logger.log(coloredMessage)

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(coloredMessage)
      })

      it('should not log when minLevel is info (default)', () => {
        const logger = getLogger()
        logger.log('Should not appear')

        expect(consoleSpy.consoleLogSpy).not.toHaveBeenCalled()
      })
    })
  })

  describe('Custom Logger', () => {
    it('should allow setting a custom logger', () => {
      const mockLogger: Logger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        success: vi.fn(),
        log: vi.fn(),
      }

      setLogger(mockLogger)

      const logger = getLogger()
      logger.info('test')
      logger.error('error')
      logger.warn('warning')
      logger.success('success')
      logger.log('log')

      expect(mockLogger.info).toHaveBeenCalledWith('test')
      expect(mockLogger.error).toHaveBeenCalledWith('error')
      expect(mockLogger.warn).toHaveBeenCalledWith('warning')
      expect(mockLogger.success).toHaveBeenCalledWith('success')
      expect(mockLogger.log).toHaveBeenCalledWith('log')

      // Console should not be called when custom logger is set
      expect(consoleSpy.consoleLogSpy).not.toHaveBeenCalled()
      expect(consoleSpy.consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('should allow custom logger with error details', () => {
      const mockLogger: Logger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        success: vi.fn(),
        log: vi.fn(),
      }

      setLogger(mockLogger)

      const logger = getLogger()
      logger.error('error message', 'error details')

      expect(mockLogger.error).toHaveBeenCalledWith('error message', 'error details')
    })
  })

  describe('resetLogger()', () => {
    it('should reset to default ConsoleLogger after setting custom logger', () => {
      const mockLogger: Logger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        success: vi.fn(),
        log: vi.fn(),
      }

      setLogger(mockLogger)
      const customLogger = getLogger()
      expect(customLogger).toBe(mockLogger)

      resetLogger()
      const defaultLogger = getLogger()

      // Should now use console again
      defaultLogger.info('test')
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(
        COLORS.CYAN,
        'clickhouse-migrations :',
        COLORS.RESET,
        'test',
      )
      expect(mockLogger.info).not.toHaveBeenCalled()
    })
  })

  describe('Integration scenarios', () => {
    it('should handle rapid sequential calls', () => {
      const logger = getLogger()

      logger.info('Message 1')
      logger.warn('Message 2')
      logger.error('Message 3')
      logger.success('Message 4')
      logger.log('Message 5')

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(3) // info, warn, success (log is filtered by default)
      expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledTimes(1) // error
    })

    it('should handle special characters in messages', () => {
      const logger = getLogger()
      const specialChars = 'Test with: @#$%^&*()[]{}|\\<>?/~`'

      logger.info(specialChars)
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(
        COLORS.CYAN,
        'clickhouse-migrations :',
        COLORS.RESET,
        specialChars,
      )
    })

    it('should handle unicode and emojis', () => {
      const logger = getLogger()
      const unicodeMessage = 'Success! ✓ ✅ 🎉 中文'

      logger.info(unicodeMessage)
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(
        COLORS.CYAN,
        'clickhouse-migrations :',
        COLORS.RESET,
        unicodeMessage,
      )
    })

    it('should work correctly when switching between loggers multiple times', () => {
      const mockLogger1: Logger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        success: vi.fn(),
        log: vi.fn(),
      }

      const mockLogger2: Logger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        success: vi.fn(),
        log: vi.fn(),
      }

      // Use default
      getLogger().info('default 1')
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)

      // Switch to mock 1
      setLogger(mockLogger1)
      getLogger().info('mock 1')
      expect(mockLogger1.info).toHaveBeenCalledWith('mock 1')
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1) // Still 1, no new console calls

      // Switch to mock 2
      setLogger(mockLogger2)
      getLogger().info('mock 2')
      expect(mockLogger2.info).toHaveBeenCalledWith('mock 2')
      expect(mockLogger1.info).toHaveBeenCalledTimes(1) // Still 1, not called again

      // Reset to default
      resetLogger()
      getLogger().info('default 2')
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(2) // Now 2
    })
  })

  describe('JSON Logger', () => {
    beforeEach(() => {
      configureLogger({ format: 'json' })
    })

    describe('info()', () => {
      it('should log info messages as JSON with INFO severity', () => {
        const logger = getLogger()
        logger.info('Test info message')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)
        const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
        const parsed = JSON.parse(logOutput)

        expect(parsed).toMatchObject({
          severity: 'INFO',
          message: 'Test info message',
          component: 'clickhouse-migrations',
        })
        expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      })
    })

    describe('error()', () => {
      it('should log error messages as JSON with ERROR severity', () => {
        const logger = getLogger()
        logger.error('Test error message')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)
        const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
        const parsed = JSON.parse(logOutput)

        expect(parsed).toMatchObject({
          severity: 'ERROR',
          message: 'Test error message',
          component: 'clickhouse-migrations',
        })
        expect(parsed.details).toBeUndefined()
      })

      it('should include details field when error details provided', () => {
        const logger = getLogger()
        logger.error('Test error', 'Error details here')

        const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
        const parsed = JSON.parse(logOutput)

        expect(parsed).toMatchObject({
          severity: 'ERROR',
          message: 'Test error',
          details: 'Error details here',
          component: 'clickhouse-migrations',
        })
      })
    })

    describe('warn()', () => {
      it('should log warning messages as JSON with WARNING severity', () => {
        const logger = getLogger()
        logger.warn('Test warning message')

        const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
        const parsed = JSON.parse(logOutput)

        expect(parsed).toMatchObject({
          severity: 'WARNING',
          message: 'Test warning message',
          component: 'clickhouse-migrations',
        })
      })
    })

    describe('success()', () => {
      it('should log success messages as JSON with NOTICE severity', () => {
        const logger = getLogger()
        logger.success('Operation completed')

        const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
        const parsed = JSON.parse(logOutput)

        expect(parsed).toMatchObject({
          severity: 'NOTICE',
          message: 'Operation completed',
          component: 'clickhouse-migrations',
        })
      })
    })

    describe('log()', () => {
      it('should log plain messages as JSON with DEFAULT severity', () => {
        configureLogger({ format: 'json', minLevel: 'debug' })
        const logger = getLogger()
        logger.log('Plain log message')

        const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
        const parsed = JSON.parse(logOutput)

        expect(parsed).toMatchObject({
          severity: 'DEFAULT',
          message: 'Plain log message',
          component: 'clickhouse-migrations',
        })
      })
    })

    it('should handle special characters and escape them properly in JSON', () => {
      const logger = getLogger()
      const specialMessage = 'Message with "quotes" and \n newline \t tab'
      logger.info(specialMessage)

      const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logOutput)

      expect(parsed.message).toBe(specialMessage)
    })

    it('should use custom prefix when provided', () => {
      configureLogger({ format: 'json', prefix: 'custom-app' })
      const logger = getLogger()
      logger.info('Test message')

      const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logOutput)

      expect(parsed.component).toBe('custom-app')
    })
  })

  describe('Log Level Filtering - Console Logger', () => {
    it('should filter logs below minimum level (minLevel: error)', () => {
      configureLogger({ format: 'console', minLevel: 'error' })
      const logger = getLogger()

      logger.info('info message')
      logger.warn('warn message')
      logger.success('success message')
      logger.error('error message')

      // Only error should be logged
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(0)
      expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledTimes(1)
    })

    it('should filter logs below minimum level (minLevel: warn)', () => {
      configureLogger({ format: 'console', minLevel: 'warn' })
      const logger = getLogger()

      logger.info('info message')
      logger.warn('warn message')
      logger.success('success message')
      logger.error('error message')

      // warn and error should be logged (success is treated as info level)
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1) // warn
      expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledTimes(1) // error
    })

    it('should log all messages when minLevel is debug', () => {
      configureLogger({ format: 'console', minLevel: 'debug' })
      const logger = getLogger()

      logger.log('log message')
      logger.info('info message')
      logger.warn('warn message')
      logger.error('error message')

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(3) // log, info, warn
      expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledTimes(1) // error
    })

    it('should use info as default minimum level', () => {
      configureLogger({ format: 'console' }) // no minLevel specified
      const logger = getLogger()

      logger.log('log message') // debug level, should not appear
      logger.info('info message')
      logger.warn('warn message')

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(2) // info, warn (no log)
    })
  })

  describe('Log Level Filtering - JSON Logger', () => {
    it('should filter logs below minimum level (minLevel: error)', () => {
      configureLogger({ format: 'json', minLevel: 'error' })
      const logger = getLogger()

      logger.info('info message')
      logger.warn('warn message')
      logger.success('success message')
      logger.error('error message')

      // Only error should be logged
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)
      const parsed = JSON.parse(consoleSpy.consoleLogSpy.mock.calls[0][0])
      expect(parsed.severity).toBe('ERROR')
    })

    it('should filter logs below minimum level (minLevel: warn)', () => {
      configureLogger({ format: 'json', minLevel: 'warn' })
      const logger = getLogger()

      logger.info('info message')
      logger.warn('warn message')
      logger.error('error message')

      // warn and error should be logged
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(2)
      const parsed1 = JSON.parse(consoleSpy.consoleLogSpy.mock.calls[0][0])
      const parsed2 = JSON.parse(consoleSpy.consoleLogSpy.mock.calls[1][0])
      expect(parsed1.severity).toBe('WARNING')
      expect(parsed2.severity).toBe('ERROR')
    })

    it('should log all messages when minLevel is debug', () => {
      configureLogger({ format: 'json', minLevel: 'debug' })
      const logger = getLogger()

      logger.log('log message')
      logger.info('info message')
      logger.warn('warn message')
      logger.error('error message')

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(4)
      const severities = consoleSpy.consoleLogSpy.mock.calls.map((call) => JSON.parse(call[0]).severity)
      expect(severities).toEqual(['DEFAULT', 'INFO', 'WARNING', 'ERROR'])
    })
  })

  describe('createLogger()', () => {
    it('should create console logger by default', () => {
      const logger = createLogger()
      setLogger(logger)
      getLogger().info('test')

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(
        COLORS.CYAN,
        'clickhouse-migrations :',
        COLORS.RESET,
        'test',
      )
    })

    it('should create JSON logger when format is json', () => {
      const logger = createLogger({ format: 'json' })
      setLogger(logger)
      getLogger().info('test')

      const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logOutput)
      expect(parsed.severity).toBe('INFO')
    })

    it('should use custom prefix', () => {
      const logger = createLogger({ format: 'json', prefix: 'my-app' })
      setLogger(logger)
      getLogger().info('test')

      const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logOutput)
      expect(parsed.component).toBe('my-app')
    })

    it('should apply minimum log level', () => {
      const logger = createLogger({ format: 'console', minLevel: 'error' })
      setLogger(logger)
      getLogger().info('test info')
      getLogger().error('test error')

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(0)
      expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('configureLogger()', () => {
    it('should configure the global logger instance', () => {
      configureLogger({ format: 'json' })
      const logger = getLogger()
      logger.info('test')

      const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logOutput)
      expect(parsed.severity).toBe('INFO')
    })

    it('should replace previous configuration', () => {
      configureLogger({ format: 'json' })
      getLogger().info('json message')

      configureLogger({ format: 'console' })
      getLogger().info('console message')

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(2)
      // First call is JSON
      const firstCall = consoleSpy.consoleLogSpy.mock.calls[0][0]
      expect(() => JSON.parse(firstCall)).not.toThrow()

      // Second call is console format (multiple arguments)
      expect(consoleSpy.consoleLogSpy.mock.calls[1]).toEqual([
        COLORS.CYAN,
        'clickhouse-migrations :',
        COLORS.RESET,
        'console message',
      ])
    })
  })

  describe('Integration: Format and Level combinations', () => {
    it('should work with console format and warn level', () => {
      configureLogger({ format: 'console', minLevel: 'warn' })
      const logger = getLogger()

      logger.info('should not appear')
      logger.warn('should appear')
      logger.error('should also appear')

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)
      expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledTimes(1)
    })

    it('should work with json format and debug level', () => {
      configureLogger({ format: 'json', minLevel: 'debug' })
      const logger = getLogger()

      logger.log('debug message')
      logger.info('info message')

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(2)
      const severities = consoleSpy.consoleLogSpy.mock.calls.map((call) => JSON.parse(call[0]).severity)
      expect(severities).toEqual(['DEFAULT', 'INFO'])
    })

    it('should work with custom prefix, json format, and error level', () => {
      configureLogger({ format: 'json', minLevel: 'error', prefix: 'test-app' })
      const logger = getLogger()

      logger.info('should not appear')
      logger.warn('should not appear')
      logger.error('should appear')

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)
      const parsed = JSON.parse(consoleSpy.consoleLogSpy.mock.calls[0][0])
      expect(parsed).toMatchObject({
        severity: 'ERROR',
        message: 'should appear',
        component: 'test-app',
      })
    })
  })
})
