import { SeedValidator } from '../../../prisma/seeds/utils/seed-validator';

describe('SeedValidator', () => {
  describe('validateRequired', () => {
    it('should not throw when all required fields are present', () => {
      const data = { name: 'Test', email: 'test@test.com' };
      expect(() => {
        SeedValidator.validateRequired(data, ['name', 'email']);
      }).not.toThrow();
    });

    it('should throw when required fields are missing', () => {
      const data = { name: 'Test' };
      expect(() => {
        SeedValidator.validateRequired(data, ['name', 'email']);
      }).toThrow('Missing required fields: email');
    });

    it('should throw when multiple required fields are missing', () => {
      const data = {};
      expect(() => {
        SeedValidator.validateRequired(data, ['name', 'email', 'age']);
      }).toThrow('Missing required fields: name, email, age');
    });
  });

  describe('validatePattern', () => {
    it('should not throw when value matches pattern', () => {
      expect(() => {
        SeedValidator.validatePattern('test-slug', /^[a-z-]+$/, 'slug');
      }).not.toThrow();
    });

    it('should throw when value does not match pattern', () => {
      expect(() => {
        SeedValidator.validatePattern('Test123', /^[a-z-]+$/, 'slug');
      }).toThrow('Field slug does not match required pattern');
    });
  });

  describe('validateRange', () => {
    it('should not throw when value is within range', () => {
      expect(() => {
        SeedValidator.validateRange(5, 1, 10, 'age');
      }).not.toThrow();
    });

    it('should throw when value is below minimum', () => {
      expect(() => {
        SeedValidator.validateRange(0, 1, 10, 'age');
      }).toThrow('Field age must be between 1 and 10');
    });

    it('should throw when value is above maximum', () => {
      expect(() => {
        SeedValidator.validateRange(11, 1, 10, 'age');
      }).toThrow('Field age must be between 1 and 10');
    });
  });

  describe('validateEnum', () => {
    it('should not throw when value is in allowed values', () => {
      expect(() => {
        SeedValidator.validateEnum('active', ['active', 'inactive'], 'status');
      }).not.toThrow();
    });

    it('should throw when value is not in allowed values', () => {
      expect(() => {
        SeedValidator.validateEnum('pending', ['active', 'inactive'], 'status');
      }).toThrow('Field status must be one of: active, inactive');
    });
  });

  describe('validateEmail', () => {
    it('should not throw for valid email', () => {
      expect(() => {
        SeedValidator.validateEmail('test@example.com');
      }).not.toThrow();
    });

    it('should throw for invalid email', () => {
      expect(() => {
        SeedValidator.validateEmail('invalid-email');
      }).toThrow('Invalid email format: invalid-email');
    });
  });

  describe('validateNotEmpty', () => {
    it('should not throw for non-empty array', () => {
      expect(() => {
        SeedValidator.validateNotEmpty([1, 2, 3], 'items');
      }).not.toThrow();
    });

    it('should throw for empty array', () => {
      expect(() => {
        SeedValidator.validateNotEmpty([], 'items');
      }).toThrow('Field items must not be empty');
    });

    it('should throw for non-array value', () => {
      expect(() => {
        SeedValidator.validateNotEmpty('not an array' as any, 'items');
      }).toThrow('Field items must not be empty');
    });
  });
});
