import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

/**
 * Module permission input type
 */
@InputType()
export class ModulePermissionInput {
  @Field(() => String, { description: 'Module name (e.g., INVENTORY, SALES)' })
  module!: string;

  @Field(() => [String], { description: 'Array of actions (e.g., CREATE, READ, UPDATE)' })
  actions!: string[];
}

/**
 * Grant permissions input
 */
@InputType()
export class GrantPermissionsInput {
  @Field(() => String, { description: 'User ID to grant permissions to' })
  userId!: string;

  @Field(() => [ModulePermissionInput], { description: 'Permissions to grant' })
  permissions!: ModulePermissionInput[];
}

/**
 * Revoke permissions input
 */
@InputType()
export class RevokePermissionsInput {
  @Field(() => String, { description: 'User ID to revoke permissions from' })
  userId!: string;

  @Field(() => [String], { description: 'Module names to revoke' })
  modules!: string[];
}

/**
 * Module permission output type
 */
@ObjectType()
export class ModulePermissionType {
  @Field(() => String, { description: 'Module name' })
  module!: string;

  @Field(() => [String], { description: 'Array of actions' })
  actions!: string[];
}

/**
 * User permissions response
 */
@ObjectType()
export class UserPermissionsResponse {
  @Field(() => String, { description: 'User ID' })
  userId!: string;

  @Field(() => [ModulePermissionType], { description: 'User permissions by module' })
  permissions!: ModulePermissionType[];

  @Field(() => String, { description: 'Permission fingerprint hash' })
  fingerprint!: string;
}

/**
 * Permission snapshot type
 */
@ObjectType()
export class PermissionSnapshotType {
  @Field(() => String, { description: 'Snapshot ID' })
  id!: string;

  @Field(() => String, { description: 'User ID' })
  userId!: string;

  @Field(() => GraphQLJSON, { description: 'Snapshot data (permissions at time of snapshot)' })
  snapshotData!: any;

  @Field(() => String, { description: 'Permission fingerprint hash' })
  fingerprintHash!: string;

  @Field(() => String, { description: 'Reason for snapshot (PERMISSION_GRANT, PERMISSION_REVOKE, etc.)' })
  reason!: string;

  @Field(() => Date, { description: 'Snapshot creation timestamp' })
  createdAt!: Date;
}

/**
 * Permission history response
 */
@ObjectType()
export class PermissionHistoryResponse {
  @Field(() => String, { description: 'User ID' })
  userId!: string;

  @Field(() => [PermissionSnapshotType], { description: 'Permission snapshots ordered by date' })
  snapshots!: PermissionSnapshotType[];

  @Field(() => Number, { description: 'Total number of snapshots' })
  total!: number;
}
