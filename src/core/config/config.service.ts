import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { AppConfig } from './configuration';

/**
 * Enhanced configuration service
 * Provides additional features beyond basic ConfigService:
 * - Sensitive value masking
 * - Type-safe nested configuration access
 * - Configuration hot-reloading support
 */
@Injectable()
export class ConfigService {
  // List of sensitive configuration keys that should be masked in logs
  private readonly sensitiveKeys = [
    'JWT_SECRET',
    'REFRESH_TOKEN_SECRET',
    'DATABASE_URL',
    'REDIS_PASSWORD',
    'QUEUE_REDIS_PASSWORD',
    'SESSION_SECRET',
    'password',
    'secret',
    'token',
    'key',
  ];

  // Cache for hot-reloadable configuration values
  private hotReloadCache = new Map<string, any>();

  // List of configuration keys that support hot-reloading
  private readonly hotReloadableKeys = [
    'LOG_LEVEL',
    'CACHE_TTL',
    'CACHE_MAX_MEMORY',
    'QUEUE_DEFAULT_JOB_ATTEMPTS',
    'GRAPHQL_PLAYGROUND',
    'GRAPHQL_INTROSPECTION',
  ];

  constructor(private readonly nestConfigService: NestConfigService) {}

  /**
   * Get configuration value with type safety
   * @param key Configuration key (supports dot notation for nested values)
   * @param defaultValue Optional default value
   */
  get<T = any>(key: string, defaultValue?: T): T {
    // Check hot-reload cache first for reloadable keys
    if (this.hotReloadableKeys.includes(key) && this.hotReloadCache.has(key)) {
      return this.hotReloadCache.get(key) as T;
    }

    return this.nestConfigService.get<T>(key, defaultValue as T);
  }

  /**
   * Get all configuration as typed object
   */
  getAll(): AppConfig {
    return this.nestConfigService.get<AppConfig>('') as AppConfig;
  }

  /**
   * Get configuration value or throw if not found
   * @param key Configuration key
   */
  getOrThrow<T = any>(key: string): T {
    return this.nestConfigService.getOrThrow<T>(key);
  }

  /**
   * Check if a configuration key is sensitive
   * @param key Configuration key to check
   */
  isSensitive(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return this.sensitiveKeys.some((sensitiveKey) =>
      lowerKey.includes(sensitiveKey.toLowerCase()),
    );
  }

  /**
   * Mask sensitive configuration value for logging
   * @param key Configuration key
   * @param value Configuration value
   */
  maskValue(key: string, value: any): string {
    if (!this.isSensitive(key)) {
      return String(value);
    }

    if (typeof value !== 'string' || value.length === 0) {
      return '***';
    }

    // Show first 3 and last 3 characters for debugging
    if (value.length <= 6) {
      return '***';
    }

    return `${value.substring(0, 3)}***${value.substring(value.length - 3)}`;
  }

  /**
   * Get configuration value with masking for logs
   * @param key Configuration key
   */
  getMasked(key: string): string {
    const value = this.get(key);
    return this.maskValue(key, value);
  }

  /**
   * Get all configuration with sensitive values masked
   * Useful for logging configuration on startup
   */
  getAllMasked(): Record<string, any> {
    const config = this.getAll();
    return this.maskObject(config);
  }

  /**
   * Recursively mask sensitive values in an object
   * @param obj Object to mask
   */
  private maskObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.maskObject(item));
    }

    const masked: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitive(key)) {
        masked[key] = this.maskValue(key, value);
      } else if (typeof value === 'object') {
        masked[key] = this.maskObject(value);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  /**
   * Hot-reload a configuration value (for non-critical settings only)
   * @param key Configuration key
   * @param value New configuration value
   * @throws Error if key is not hot-reloadable
   */
  hotReload(key: string, value: any): void {
    if (!this.hotReloadableKeys.includes(key)) {
      throw new Error(
        `Configuration key "${key}" does not support hot-reloading. ` +
          `Hot-reloadable keys: ${this.hotReloadableKeys.join(', ')}`,
      );
    }

    // Validate the new value based on the key
    this.validateHotReloadValue(key, value);

    // Update the cache
    this.hotReloadCache.set(key, value);
  }

  /**
   * Validate hot-reloaded configuration value
   * @param key Configuration key
   * @param value New value to validate
   */
  private validateHotReloadValue(key: string, value: any): void {
    switch (key) {
      case 'LOG_LEVEL':
        if (!['error', 'warn', 'info', 'debug', 'verbose'].includes(value)) {
          throw new Error(
            `Invalid LOG_LEVEL: ${value}. Must be one of: error, warn, info, debug, verbose`,
          );
        }
        break;

      case 'CACHE_TTL':
      case 'QUEUE_DEFAULT_JOB_ATTEMPTS':
        if (typeof value !== 'number' || value < 0) {
          throw new Error(`${key} must be a non-negative number`);
        }
        break;

      case 'CACHE_MAX_MEMORY':
        if (typeof value !== 'string' || !/^\d+(mb|gb)$/i.test(value)) {
          throw new Error(
            `${key} must be a string in format: <number>mb or <number>gb`,
          );
        }
        break;

      case 'GRAPHQL_PLAYGROUND':
      case 'GRAPHQL_INTROSPECTION':
        if (typeof value !== 'boolean') {
          throw new Error(`${key} must be a boolean`);
        }
        break;

      default:
        // No specific validation
        break;
    }
  }

  /**
   * Clear hot-reload cache for a specific key or all keys
   * @param key Optional configuration key to clear
   */
  clearHotReloadCache(key?: string): void {
    if (key) {
      this.hotReloadCache.delete(key);
    } else {
      this.hotReloadCache.clear();
    }
  }

  /**
   * Get list of hot-reloadable configuration keys
   */
  getHotReloadableKeys(): string[] {
    return [...this.hotReloadableKeys];
  }
}
