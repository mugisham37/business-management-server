import { Field, ObjectType, Int } from '@nestjs/graphql';

@ObjectType()
export class PageInfo {
  @Field(() => Int)
  totalCount: number;

  @Field(() => Int)
  pageSize: number;

  @Field(() => Int)
  currentPage: number;

  @Field(() => Int)
  totalPages: number;

  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;
}

@ObjectType()
export abstract class PaginatedResponse {
  @Field(() => PageInfo)
  pageInfo: PageInfo;
}
