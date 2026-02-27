/**
 * Seed data validation utilities
 */

export class SeedValidator {
  /**
   * Validate that required fields are present
   */
  static validateRequired(data: any, fields: string[]): void {
    const missing = fields.filter((field) => !data[field]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required fields: ${missing.join(', ')}`,
      );
    }
  }

  /**
   * Validate that a field matches a pattern
   */
  static validatePattern(
    value: string,
    pattern: RegExp,
    fieldName: string,
  ): void {
    if (!pattern.test(value)) {
      throw new Error(
        `Field ${fieldName} does not match required pattern`,
      );
    }
  }

  /**
   * Validate that a value is within a range
   */
  static validateRange(
    value: number,
    min: number,
    max: number,
    fieldName: string,
  ): void {
    if (value < min || value > max) {
      throw new Error(
        `Field ${fieldName} must be between ${min} and ${max}`,
      );
    }
  }

  /**
   * Validate that a value is one of allowed values
   */
  static validateEnum(
    value: any,
    allowedValues: any[],
    fieldName: string,
  ): void {
    if (!allowedValues.includes(value)) {
      throw new Error(
        `Field ${fieldName} must be one of: ${allowedValues.join(', ')}`,
      );
    }
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): void {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      throw new Error(`Invalid email format: ${email}`);
    }
  }

  /**
   * Validate that an array is not empty
   */
  static validateNotEmpty(arr: any[], fieldName: string): void {
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error(`Field ${fieldName} must not be empty`);
    }
  }
}
