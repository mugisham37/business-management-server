import { Field, ObjectType, ID, InputType } from '@nestjs/graphql';
import { HierarchyLevel, UserStatus } from '@prisma/client';

/**
 * Staff Profile Input Type
 */
@InputType()
export class StaffProfileInput {
  @Field()
  fullName!: string;

  @Field({ nullable: true })
  positionTitle?: string;

  @Field({ nullable: true })
  employeeCode?: string;

  @Field({ nullable: true })
  hireDate?: Date;
}

/**
 * Create Manager Input Type
 */
@InputType()
export class CreateManagerInput {
  @Field()
  email!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  organizationId!: string;

  @Field({ nullable: true })
  branchId?: string;

  @Field({ nullable: true })
  departmentId?: string;

  @Field(() => StaffProfileInput)
  staffProfile!: StaffProfileInput;
}

/**
 * Create Worker Input Type
 */
@InputType()
export class CreateWorkerInput {
  @Field()
  email!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  organizationId!: string;

  @Field(() => StaffProfileInput)
  staffProfile!: StaffProfileInput;

  @Field({ nullable: true, defaultValue: false })
  usePIN?: boolean;
}

/**
 * Update User Input Type
 */
@InputType()
export class UpdateUserManagementInput {
  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  status?: UserStatus;

  @Field({ nullable: true })
  branchId?: string;

  @Field({ nullable: true })
  departmentId?: string;
}

/**
 * Staff Profile Type
 */
@ObjectType()
export class StaffProfileType {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field()
  fullName!: string;

  @Field({ nullable: true })
  positionTitle?: string;

  @Field({ nullable: true })
  employeeCode?: string;

  @Field({ nullable: true })
  hireDate?: Date;

  @Field({ nullable: true })
  reportsToUserId?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

/**
 * User Type for User Management
 */
@ObjectType()
export class UserManagementType {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field(() => String)
  hierarchyLevel!: HierarchyLevel;

  @Field(() => String)
  status!: UserStatus;

  @Field()
  organizationId!: string;

  @Field({ nullable: true })
  branchId?: string;

  @Field({ nullable: true })
  departmentId?: string;

  @Field({ nullable: true })
  createdById?: string;

  @Field(() => StaffProfileType, { nullable: true })
  staffProfile?: StaffProfileType;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

/**
 * Create User Response Type
 */
@ObjectType()
export class CreateUserResponse {
  @Field(() => UserManagementType)
  user!: UserManagementType;

  @Field()
  temporaryCredential!: string;

  @Field()
  credentialType!: string;
}

/**
 * Users List Response Type
 */
@ObjectType()
export class UsersListResponse {
  @Field(() => [UserManagementType])
  users!: UserManagementType[];

  @Field()
  total!: number;
}
