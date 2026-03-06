import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MinLength,
  Matches,
  IsArray,
  IsBoolean,
  IsUrl,
} from 'class-validator';
import { OrganizationType } from '@prisma/client';

/**
 * DTO for owner registration with email/password
 * Includes comprehensive onboarding data
 */
export class RegisterOwnerDto {
  // Personal Information
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  // Organization Information
  @IsString()
  organizationName!: string;

  @IsString()
  industry!: string;

  @IsString()
  companySize!: string;

  @IsOptional()
  @IsString()
  website?: string;

  // Business Operations
  @IsString()
  businessType!: string;

  @IsArray()
  @IsString({ each: true })
  primaryActivities!: string[];

  @IsString()
  businessStage!: string;

  // Business Goals
  @IsArray()
  @IsString({ each: true })
  businessGoals!: string[];

  @IsString()
  timeline!: string;

  // User Preferences
  @IsString()
  currency!: string;

  @IsString()
  timezone!: string;

  @IsBoolean()
  emailNotifications!: boolean;

  @IsBoolean()
  weeklyReports!: boolean;

  @IsBoolean()
  marketingUpdates!: boolean;

  // Computed field (not from frontend)
  organizationType?: OrganizationType;
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
