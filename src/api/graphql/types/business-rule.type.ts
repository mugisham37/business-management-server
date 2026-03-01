import { ObjectType, Field, InputType, Int } from '@nestjs/graphql';
import { HierarchyLevel } from '@prisma/client';

/**
 * Business Rule GraphQL Type
 */
@ObjectType()
export class BusinessRuleType {
  @Field()
  id!: string;

  @Field()
  organizationId!: string;

  @Field()
  ruleName!: string;

  @Field()
  transactionType!: string;

  @Field()
  basedOn!: string;

  @Field()
  thresholdValue!: number;

  @Field()
  appliesToLevel!: HierarchyLevel;

  @Field()
  approverLevel!: HierarchyLevel;

  @Field()
  isActive!: boolean;

  @Field(() => Int)
  priority!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

/**
 * Input Types
 */
@InputType()
export class CreateBusinessRuleInput {
  @Field()
  ruleName!: string;

  @Field()
  transactionType!: string;

  @Field()
  basedOn!: string;

  @Field()
  thresholdValue!: number;

  @Field()
  appliesToLevel!: HierarchyLevel;

  @Field()
  approverLevel!: HierarchyLevel;

  @Field(() => Int)
  priority!: number;
}

@InputType()
export class UpdateBusinessRuleInput {
  @Field({ nullable: true })
  ruleName?: string;

  @Field({ nullable: true })
  transactionType?: string;

  @Field({ nullable: true })
  basedOn?: string;

  @Field({ nullable: true })
  thresholdValue?: number;

  @Field({ nullable: true })
  appliesToLevel?: HierarchyLevel;

  @Field({ nullable: true })
  approverLevel?: HierarchyLevel;

  @Field(() => Int, { nullable: true })
  priority?: number;

  @Field({ nullable: true })
  isActive?: boolean;
}

/**
 * Response Types
 */
@ObjectType()
export class BusinessRulesListResponse {
  @Field(() => [BusinessRuleType])
  rules!: BusinessRuleType[];

  @Field()
  total!: number;
}
