import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { classToPlain, ClassTransformOptions } from 'class-transformer';

/**
 * Transform interceptor for DTO transformation
 * Handles serialization, sensitive field exclusion, and date formatting
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  private readonly transformOptions: ClassTransformOptions = {
    excludeExtraneousValues: false,
    enableImplicitConversion: true,
    exposeUnsetFields: false,
  };

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Skip transformation for null/undefined
        if (data === null || data === undefined) {
          return data;
        }

        // Transform the response data
        return this.transformData(data);
      }),
    );
  }

  /**
   * Transform data by applying class-transformer rules
   */
  private transformData(data: any): any {
    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.transformData(item));
    }

    // Handle objects
    if (typeof data === 'object' && data !== null) {
      // Apply class-transformer serialization
      const transformed = classToPlain(data, this.transformOptions);

      // Exclude sensitive fields
      const sanitized = this.excludeSensitiveFields(transformed);

      // Transform dates to ISO 8601 format
      return this.transformDates(sanitized);
    }

    return data;
  }

  /**
   * Exclude sensitive fields from serialization
   */
  private excludeSensitiveFields(obj: any): any {
    const sensitiveFields = [
      'password',
      'passwordHash',
      'secret',
      'secretKey',
      'apiKey',
      'token',
      'refreshToken',
      'accessToken',
      'privateKey',
      'salt',
    ];

    if (Array.isArray(obj)) {
      return obj.map((item) => this.excludeSensitiveFields(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};

      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          // Skip sensitive fields
          if (sensitiveFields.includes(key)) {
            continue;
          }

          // Recursively sanitize nested objects
          sanitized[key] = this.excludeSensitiveFields(obj[key]);
        }
      }

      return sanitized;
    }

    return obj;
  }

  /**
   * Transform dates to ISO 8601 format
   */
  private transformDates(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.transformDates(item));
    }

    if (obj instanceof Date) {
      return obj.toISOString();
    }

    if (typeof obj === 'object' && obj !== null) {
      const transformed: any = {};

      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];

          // Transform Date objects to ISO 8601 strings
          if (value instanceof Date) {
            transformed[key] = value.toISOString();
          }
          // Recursively transform nested objects
          else if (typeof value === 'object' && value !== null) {
            transformed[key] = this.transformDates(value);
          }
          // Keep other values as-is
          else {
            transformed[key] = value;
          }
        }
      }

      return transformed;
    }

    return obj;
  }
}
