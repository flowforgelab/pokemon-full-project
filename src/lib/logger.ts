/**
 * Simple logger utility for the application
 * In production, this could be replaced with a more robust logging solution
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const logMessage = {
      timestamp,
      level,
      message,
      ...context,
    };

    // In development, use console methods
    if (this.isDevelopment) {
      switch (level) {
        case 'debug':
          console.debug(`[${timestamp}] DEBUG:`, message, context || '');
          break;
        case 'info':
          console.info(`[${timestamp}] INFO:`, message, context || '');
          break;
        case 'warn':
          console.warn(`[${timestamp}] WARN:`, message, context || '');
          break;
        case 'error':
          console.error(`[${timestamp}] ERROR:`, message, context || '');
          break;
      }
    } else {
      // In production, you might want to send logs to a service
      // For now, we'll just use console.log with structured data
      console.log(JSON.stringify(logMessage));
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext) {
    this.log('error', message, context);
  }
}

// Export a singleton instance
export const logger = new Logger();