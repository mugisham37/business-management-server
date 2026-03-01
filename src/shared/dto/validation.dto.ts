import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
  IsNumberString,
  Length,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

/**
 * Email validation DTO
 * Requirement 20.2: Email format validation
 */
export class EmailDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;
}

/**
 * Password validation DTO
 * Requirement 14.1: Password strength validation
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export class PasswordDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password!: string;
}

/**
 * PIN validation DTO
 * Requirement 14.2: PIN format validation
 * - 4-6 digits only
 */
export class PinDto {
  @IsNumberString({}, { message: 'PIN must contain only digits' })
  @Length(4, 6, { message: 'PIN must be between 4 and 6 digits' })
  pin!: string;
}

/**
 * Code validation DTO
 * Requirement 20.3: Code format validation for branches and departments
 * - Alphanumeric only
 * - 2-10 characters
 */
export class CodeDto {
  @IsString()
  @MinLength(2, { message: 'Code must be at least 2 characters long' })
  @MaxLength(10, { message: 'Code must not exceed 10 characters' })
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'Code must contain only alphanumeric characters',
  })
  code!: string;
}

/**
 * Combined validation DTO for user creation with email and password
 */
export class UserCredentialsDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password!: string;
}

/**
 * Combined validation DTO for worker authentication with PIN
 */
export class WorkerPinDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @IsNumberString({}, { message: 'PIN must contain only digits' })
  @Length(4, 6, { message: 'PIN must be between 4 and 6 digits' })
  pin!: string;
}

/**
 * Branch/Department code validation DTO
 */
export class OrganizationCodeDto {
  @IsString()
  @MinLength(2, { message: 'Code must be at least 2 characters long' })
  @MaxLength(10, { message: 'Code must not exceed 10 characters' })
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'Code must contain only alphanumeric characters',
  })
  code!: string;

  @IsString()
  @MinLength(1, { message: 'Name is required' })
  name!: string;
}
