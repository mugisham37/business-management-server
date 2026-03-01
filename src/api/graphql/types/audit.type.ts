import { ObjectType, Field, InputType, Int } from '@nestjs/graphql';
import { HierarchyLevel } from '@prisma/client';
import GraphQLJSON from 'graphql-type-json';

/**
 * Audit Log GraphQL Type
 * 
 * Represents an immutable audit log record
 * Requirements: 12.1, 12.5
 */
@ObjectType()
export class AuditLogType {
  @Field()
  id!: string;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  organizationId?: string;

  @Field(() => String, { nullable: true })
  hierarchyLevel?: HierarchyLevel;

  @Field()
  action!: string;

  @Field()
  resourceType!: string;

  @Field({ nullable: true })
  resourceId?: string;

  @Field()
  result!: string;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;

  @Field(() => GraphQLJSON, { nullable: true })
  oldValue?: Record<string, any>;

  @Field(() => GraphQLJSON, { nullable: true })
  newValue?: Record<string, any>;

  @Field({ nullable: true })
  ipAddress?: string;

  @Field({ nullable: true })
  userAgent?: string;

  @Field()
  createdAt!: Date;
}

/**
 * Audit Logs List Response
 */
@ObjectType()
export class AuditLogsResponse {
  @Field(() => [AuditLogType])
  logs!: AuditLogType[];

  @Field(() => Int)
  total!: number;
}

/**
 * Audit Filters Input
 * 
 * Filters for querying audit logs
 */
@InputType()
export class AuditFiltersInput {
  @Field({ nullable: true })
  action?: string;

  @Field({ nullable: true })
  resourceType?: string;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field(() => Int, { nullable: true, defaultValue: 100 })
  limit?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  offset?: number;
}
