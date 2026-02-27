import { Field, ObjectType, ID, InputType, Int } from '@nestjs/graphql';
import { PaginatedResponse, PageInfo } from './pagination.type';

@ObjectType()
export class UserType {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  isActive!: boolean;

  @Field()
  tenantId!: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class UsersResponse extends PaginatedResponse {
  @Field(() => [UserType])
  users!: UserType[];
}

@InputType()
export class CreateUserInput {
  @Field()
  email!: string;

  @Field()
  password!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  tenantId!: string;
}

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  isActive?: boolean;
}

@InputType()
export class PaginationInput {
  @Field(() => Int, { defaultValue: 1 })
  page!: number;

  @Field(() => Int, { defaultValue: 10 })
  limit!: number;

  @Field({ defaultValue: 'createdAt' })
  sortBy!: string;

  @Field({ defaultValue: 'desc' })
  sortOrder!: string;
}
