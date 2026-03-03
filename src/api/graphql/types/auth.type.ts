import { ObjectType, Field, InputType, Int } from '@nestjs/graphql';
import { HierarchyLevel } from '@prisma/client';
import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';

@ObjectType()
export class AuthUserType {
  @Field()
  id!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  firstName!: string | null;

  @Field(() => String, { nullable: true })
  lastName!: string | null;

  @Field()
  hierarchyLevel!: HierarchyLevel;

  @Field()
  organizationId!: string;
}

@ObjectType()
export class AuthResponse {
  @Field()
  accessToken!: string;

  @Field()
  refreshToken!: string;

  @Field(() => AuthUserType)
  user!: AuthUserType;

  @Field(() => Int)
  expiresIn!: number;
}

@InputType()
export class RegisterOwnerInput {
  @Field()
  @IsEmail()
  email!: string;

  @Field()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password!: string;

  @Field()
  @IsString()
  firstName!: string;

  @Field()
  @IsString()
  lastName!: string;

  @Field()
  @IsString()
  organizationName!: string;

  @Field()
  @IsString()
  organizationType!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  organizationSettings?: string;
}

@InputType()
export class LoginInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  organizationName?: string;

  @Field()
  @IsString()
  password!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  organizationId?: string;
}

@InputType()
export class LoginWithPinInput {
  @Field()
  email!: string;

  @Field()
  pin!: string;

  @Field()
  organizationId!: string;
}

@InputType()
export class RefreshTokenInput {
  @Field()
  refreshToken!: string;
}

@InputType()
export class ChangePasswordInput {
  @Field()
  currentPassword!: string;

  @Field()
  newPassword!: string;
}

@ObjectType()
export class SessionType {
  @Field()
  id!: string;

  @Field()
  ipAddress!: string;

  @Field()
  userAgent!: string;

  @Field()
  createdAt!: Date;

  @Field()
  expiresAt!: Date;
}

@InputType()
export class RevokeSessionInput {
  @Field()
  sessionId!: string;
}
