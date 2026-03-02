import { ObjectType, Field, InputType, Int } from '@nestjs/graphql';
import { HierarchyLevel } from '@prisma/client';

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
  email!: string;

  @Field()
  password!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  organizationName!: string;

  @Field()
  organizationType!: string;

  @Field(() => String, { nullable: true })
  organizationSettings?: string;
}

@InputType()
export class LoginInput {
  @Field()
  email!: string;

  @Field()
  password!: string;

  @Field()
  organizationId!: string;
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
