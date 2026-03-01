import { ObjectType, Field, InputType } from '@nestjs/graphql';

/**
 * Organization GraphQL Type
 */
@ObjectType()
export class OrganizationType {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  type!: string;

  @Field()
  status!: string;

  @Field(() => String, { nullable: true })
  ownerId!: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

/**
 * Branch GraphQL Type
 */
@ObjectType()
export class BranchType {
  @Field()
  id!: string;

  @Field()
  organizationId!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field(() => String, { nullable: true })
  address!: string | null;

  @Field(() => String, { nullable: true })
  managerId!: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

/**
 * Department GraphQL Type
 */
@ObjectType()
export class DepartmentType {
  @Field()
  id!: string;

  @Field()
  organizationId!: string;

  @Field(() => String, { nullable: true })
  branchId!: string | null;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field(() => String, { nullable: true })
  managerId!: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

/**
 * Input Types
 */
@InputType()
export class UpdateOrganizationInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  type?: string;

  @Field({ nullable: true })
  status?: string;
}

@InputType()
export class CreateBranchInput {
  @Field()
  organizationId!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field({ nullable: true })
  address?: string;
}

@InputType()
export class UpdateBranchInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  code?: string;

  @Field({ nullable: true })
  address?: string;
}

@InputType()
export class CreateDepartmentInput {
  @Field()
  organizationId!: string;

  @Field({ nullable: true })
  branchId?: string;

  @Field()
  name!: string;

  @Field()
  code!: string;
}

@InputType()
export class UpdateDepartmentInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  code?: string;

  @Field({ nullable: true })
  branchId?: string;
}

/**
 * Response Types
 */
@ObjectType()
export class BranchesListResponse {
  @Field(() => [BranchType])
  branches!: BranchType[];

  @Field()
  total!: number;
}

@ObjectType()
export class DepartmentsListResponse {
  @Field(() => [DepartmentType])
  departments!: DepartmentType[];

  @Field()
  total!: number;
}
