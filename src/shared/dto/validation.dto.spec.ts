import { validate } from 'class-validator';
import {
  EmailDto,
  PasswordDto,
  PinDto,
  CodeDto,
  UserCredentialsDto,
  WorkerPinDto,
  OrganizationCodeDto,
} from './validation.dto';

describe('Validation DTOs', () => {
  describe('EmailDto', () => {
    it('should validate valid email addresses', async () => {
      const dto = new EmailDto();
      dto.email = 'test@example.com';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid email addresses', async () => {
      const dto = new EmailDto();
      dto.email = 'invalid-email';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });
  });

  describe('PasswordDto', () => {
    it('should validate strong passwords', async () => {
      const dto = new PasswordDto();
      dto.password = 'StrongP@ss123';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject passwords shorter than 8 characters', async () => {
      const dto = new PasswordDto();
      dto.password = 'Short1!';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject passwords without uppercase letters', async () => {
      const dto = new PasswordDto();
      dto.password = 'lowercase123!';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject passwords without lowercase letters', async () => {
      const dto = new PasswordDto();
      dto.password = 'UPPERCASE123!';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject passwords without numbers', async () => {
      const dto = new PasswordDto();
      dto.password = 'NoNumbers!';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject passwords without special characters', async () => {
      const dto = new PasswordDto();
      dto.password = 'NoSpecial123';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('PinDto', () => {
    it('should validate 4-digit PINs', async () => {
      const dto = new PinDto();
      dto.pin = '1234';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate 6-digit PINs', async () => {
      const dto = new PinDto();
      dto.pin = '123456';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject PINs shorter than 4 digits', async () => {
      const dto = new PinDto();
      dto.pin = '123';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject PINs longer than 6 digits', async () => {
      const dto = new PinDto();
      dto.pin = '1234567';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject PINs with non-numeric characters', async () => {
      const dto = new PinDto();
      dto.pin = '12a4';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('CodeDto', () => {
    it('should validate alphanumeric codes', async () => {
      const dto = new CodeDto();
      dto.code = 'ABC123';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate 2-character codes', async () => {
      const dto = new CodeDto();
      dto.code = 'AB';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate 10-character codes', async () => {
      const dto = new CodeDto();
      dto.code = 'ABCDEFGH12';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject codes shorter than 2 characters', async () => {
      const dto = new CodeDto();
      dto.code = 'A';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject codes longer than 10 characters', async () => {
      const dto = new CodeDto();
      dto.code = 'ABCDEFGH123';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject codes with special characters', async () => {
      const dto = new CodeDto();
      dto.code = 'ABC-123';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject codes with spaces', async () => {
      const dto = new CodeDto();
      dto.code = 'ABC 123';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('UserCredentialsDto', () => {
    it('should validate valid email and password', async () => {
      const dto = new UserCredentialsDto();
      dto.email = 'user@example.com';
      dto.password = 'StrongP@ss123';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid email', async () => {
      const dto = new UserCredentialsDto();
      dto.email = 'invalid-email';
      dto.password = 'StrongP@ss123';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject weak password', async () => {
      const dto = new UserCredentialsDto();
      dto.email = 'user@example.com';
      dto.password = 'weak';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('WorkerPinDto', () => {
    it('should validate valid email and PIN', async () => {
      const dto = new WorkerPinDto();
      dto.email = 'worker@example.com';
      dto.pin = '1234';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid email', async () => {
      const dto = new WorkerPinDto();
      dto.email = 'invalid-email';
      dto.pin = '1234';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid PIN', async () => {
      const dto = new WorkerPinDto();
      dto.email = 'worker@example.com';
      dto.pin = '12';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('OrganizationCodeDto', () => {
    it('should validate valid code and name', async () => {
      const dto = new OrganizationCodeDto();
      dto.code = 'BR001';
      dto.name = 'Main Branch';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid code', async () => {
      const dto = new OrganizationCodeDto();
      dto.code = 'A';
      dto.name = 'Main Branch';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty name', async () => {
      const dto = new OrganizationCodeDto();
      dto.code = 'BR001';
      dto.name = '';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
