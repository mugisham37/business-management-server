import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { LoggerService } from './logger.service';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const CORRELATION_ID_KEY = 'correlationId';

// Extend Express Request to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('CorrelationIdMiddleware');
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Extract correlation ID from header or generate a new one
    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string) || randomUUID();

    // Attach correlation ID to request object
    req[CORRELATION_ID_KEY] = correlationId;
    req.correlationId = correlationId;

    // Set correlation ID in response header
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    // Set correlation ID in logger for this request
    this.logger.setCorrelationId(correlationId);

    // Don't log here - let the HttpLoggingInterceptor handle all logging
    // This avoids duplicate logs and allows proper filtering

    next();
  }
}
