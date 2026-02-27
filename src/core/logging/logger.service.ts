import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import * as pino from 'pino';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

export interface LogMetadata {
  [key: string]: any;
}

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private logger: pino.Logger;
  private context?: string;
  private correlationId?: string;

  constructor() {
    this.logger = pino.default({
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      ...(process.env.NODE_ENV === 'development' && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
    });
  }

  /**
   * Set the context for subsequent log messages
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Set the correlation ID for request tracing
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Log an error message
   */
  error(message: string, trace?: string, context?: string): void {
    const logContext = context || this.context;
    this.logger.error(
      this.buildLogObject(message, { trace }, logContext),
      message,
    );
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: string): void {
    const logContext = context || this.context;
    this.logger.warn(this.buildLogObject(message, {}, logContext), message);
  }

  /**
   * Log an info message
   */
  log(message: string, context?: string): void {
    this.info(message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: string): void {
    const logContext = context || this.context;
    this.logger.info(this.buildLogObject(message, {}, logContext), message);
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: string): void {
    const logContext = context || this.context;
    this.logger.debug(this.buildLogObject(message, {}, logContext), message);
  }

  /**
   * Log a verbose message
   */
  verbose(message: string, context?: string): void {
    const logContext = context || this.context;
    this.logger.trace(this.buildLogObject(message, {}, logContext), message);
  }

  /**
   * Log with custom metadata
   */
  logWithMetadata(
    level: LogLevel,
    message: string,
    metadata: LogMetadata,
    context?: string,
  ): void {
    const logContext = context || this.context;
    const logObject = this.buildLogObject(message, metadata, logContext);

    switch (level) {
      case 'error':
        this.logger.error(logObject, message);
        break;
      case 'warn':
        this.logger.warn(logObject, message);
        break;
      case 'info':
        this.logger.info(logObject, message);
        break;
      case 'debug':
        this.logger.debug(logObject, message);
        break;
      case 'verbose':
        this.logger.trace(logObject, message);
        break;
    }
  }

  /**
   * Build log object with context and metadata
   */
  private buildLogObject(
    message: string,
    metadata: LogMetadata,
    context?: string,
  ): Record<string, any> {
    const logObject: Record<string, any> = {
      message,
      ...metadata,
    };

    if (context) {
      logObject.context = context;
    }

    if (this.correlationId) {
      logObject.correlationId = this.correlationId;
    }

    return logObject;
  }

  /**
   * Create a child logger with a specific context
   */
  createChildLogger(context: string): LoggerService {
    const childLogger = new LoggerService();
    childLogger.setContext(context);
    if (this.correlationId) {
      childLogger.setCorrelationId(this.correlationId);
    }
    return childLogger;
  }
}
