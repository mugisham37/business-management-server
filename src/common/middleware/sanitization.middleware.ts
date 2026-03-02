import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Sanitization Middleware
 * 
 * Sanitizes all incoming request data to prevent XSS and injection attacks
 * Requirements: 17.3, 17.4
 */
@Injectable()
export class SanitizationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Sanitize request body
    if (req.body) {
      req.body = this.sanitizeObject(req.body);
    }

    // Sanitize query parameters (Express 5 compatible)
    if (req.query && Object.keys(req.query).length > 0) {
      const sanitizedQuery = this.sanitizeObject(req.query);
      Object.keys(req.query).forEach(key => delete (req.query as any)[key]);
      Object.assign(req.query, sanitizedQuery);
    }

    // Sanitize URL parameters (Express 5 compatible)
    if (req.params && Object.keys(req.params).length > 0) {
      const sanitizedParams = this.sanitizeObject(req.params);
      Object.keys(req.params).forEach(key => delete (req.params as any)[key]);
      Object.assign(req.params, sanitizedParams);
    }

    next();
  }

  /**
   * Recursively sanitize an object
   */
  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          sanitized[key] = this.sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    return obj;
  }

  /**
   * Sanitize a string to prevent XSS
   * 
   * Removes potentially dangerous HTML/script tags and characters
   */
  private sanitizeString(str: string): string {
    if (!str) return str;

    // Remove HTML tags
    let sanitized = str.replace(/<[^>]*>/g, '');

    // Escape special characters that could be used for XSS
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Remove control characters except newline, carriage return, and tab
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }
}
