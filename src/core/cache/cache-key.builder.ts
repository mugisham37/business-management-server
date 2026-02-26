import { Injectable } from '@nestjs/common';

/**
 * Cache key builder for hierarchical key generation
 * Supports namespace and dynamic parts for organized cache keys
 */
@Injectable()
export class CacheKeyBuilder {
  private readonly separator = ':';

  /**
   * Build a hierarchical cache key
   * @param namespace Base namespace for the key
   * @param parts Dynamic parts to append to the namespace
   * @returns Formatted cache key (e.g., "user:123:profile")
   */
  build(namespace: string, ...parts: (string | number)[]): string {
    const allParts = [namespace, ...parts.map((p) => String(p))];
    return allParts.filter((p) => p !== undefined && p !== null).join(this.separator);
  }

  /**
   * Build a cache key from a pattern with parameter substitution
   * @param pattern Key pattern with {{param}} placeholders
   * @param params Object containing parameter values
   * @returns Formatted cache key with substituted values
   * @example
   * buildFromPattern('user:{{id}}:profile', { id: '123' }) => 'user:123:profile'
   */
  buildFromPattern(pattern: string, params: Record<string, any>): string {
    let key = pattern;
    
    // Replace all {{param}} placeholders with actual values
    for (const [paramName, paramValue] of Object.entries(params)) {
      const placeholder = `{{${paramName}}}`;
      key = key.replace(new RegExp(placeholder, 'g'), String(paramValue));
    }

    return key;
  }

  /**
   * Extract namespace from a cache key
   * @param key Cache key
   * @returns Namespace (first part before separator)
   */
  extractNamespace(key: string): string {
    const parts = key.split(this.separator);
    return parts[0] || '';
  }

  /**
   * Extract parts from a cache key
   * @param key Cache key
   * @returns Array of key parts
   */
  extractParts(key: string): string[] {
    return key.split(this.separator);
  }

  /**
   * Build a pattern for key invalidation
   * @param namespace Base namespace
   * @param parts Optional parts (use '*' for wildcard)
   * @returns Pattern for matching keys (e.g., "user:*" or "user:123:*")
   */
  buildPattern(namespace: string, ...parts: (string | number | '*')[]): string {
    const allParts = [namespace, ...parts.map((p) => String(p))];
    return allParts.join(this.separator);
  }

  /**
   * Check if a key matches a pattern
   * @param key Cache key to check
   * @param pattern Pattern with wildcards
   * @returns True if key matches pattern
   */
  matchesPattern(key: string, pattern: string): boolean {
    // Convert pattern to regex
    // Escape special regex characters except *
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }

  /**
   * Get parent namespace from a key
   * @param key Cache key
   * @returns Parent namespace or null if no parent
   * @example
   * getParentNamespace('user:123:profile') => 'user:123'
   */
  getParentNamespace(key: string): string | null {
    const parts = key.split(this.separator);
    if (parts.length <= 1) {
      return null;
    }
    return parts.slice(0, -1).join(this.separator);
  }

  /**
   * Get all parent namespaces for a key
   * @param key Cache key
   * @returns Array of parent namespaces from most specific to least specific
   * @example
   * getAllParentNamespaces('user:123:profile:settings') => 
   *   ['user:123:profile', 'user:123', 'user']
   */
  getAllParentNamespaces(key: string): string[] {
    const parts = key.split(this.separator);
    const parents: string[] = [];

    for (let i = parts.length - 1; i > 0; i--) {
      parents.push(parts.slice(0, i).join(this.separator));
    }

    return parents;
  }
}
