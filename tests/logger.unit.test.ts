import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COLORS, getLogger, type Logger, resetLogger, setLogger } from '../src/logger'
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
      it('should log plain messages without formatting', () => {
        const logger = getLogger()
        logger.log('Plain log message')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith('Plain log message')
      })

      it('should preserve color codes in message', () => {
        const logger = getLogger()
        const coloredMessage = `${COLORS.GREEN}Colored${COLORS.RESET} message`
        logger.log(coloredMessage)

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(coloredMessage)
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

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(4) // info, warn, success, log
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
})
