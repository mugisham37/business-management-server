import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';
import { OrganizationType } from '@prisma/client';

/**
 * DTO for owner registration with email/password
 */
export class RegisterOwnerDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  organizationName!: string;

  @IsEnum(OrganizationType)
  organizationType!: OrganizationType;

  @IsOptional()
  organizationSettings?: Record<string, any>;
}

/**
 * DTO for owner registration with Google OAuth
 */
export class RegisterOwnerGoogleDto {
  @IsString()
  googleToken!: string;

  @IsString()
  organizationName!: string;

  @IsEnum(OrganizationType)
  organizationType!: OrganizationType;

  @IsOptional()
  organizationSettings?: Record<string, any>;
}
