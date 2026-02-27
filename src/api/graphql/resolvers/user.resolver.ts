import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BaseResolver } from './base.resolver';
import { UserService } from '../../../modules/user/user.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import {
  UserType,
  UsersResponse,
  CreateUserInput,
  UpdateUserInput,
  PaginationInput,
} from '../types/user.type';
import { PageInfo } from '../types/pagination.type';

@Resolver(() => UserType)
export class UserResolver extends BaseResolver {
  constructor(private readonly userService: UserService) {
    super('UserResolver');
  }

  @Query(() => UserType, { name: 'user' })
  @UseGuards(GqlAuthGuard)
  async getUser(@Args('id') id: string): Promise<UserType> {
    this.logOperation('getUser', { id });
    const user = await this.userService.findById(id);
    return this.mapToGraphQLUser(user);
  }

  @Query(() => UserType, { name: 'userByEmail', nullable: true })
  @UseGuards(GqlAuthGuard)
  async getUserByEmail(@Args('email') email: string): Promise<UserType | null> {
    this.logOperation('getUserByEmail', { email });
    const user = await this.userService.findByEmail(email);
    return user ? this.mapToGraphQLUser(user) : null;
  }

  @Query(() => UsersResponse, { name: 'users' })
  @UseGuards(GqlAuthGuard)
  async listUsers(
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ): Promise<UsersResponse> {
    this.logOperation('listUsers', { pagination });

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const sortBy = pagination?.sortBy || 'createdAt';
    const sortOrder = pagination?.sortOrder || 'desc';

    const result = await this.userService.findAll({
      page,
      limit,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    return {
      users: result.data.map((user) => this.mapToGraphQLUser(user)),
      pageInfo: {
        totalCount: result.total,
        pageSize: result.limit,
        currentPage: result.page,
        totalPages: result.totalPages,
        hasNextPage: result.page < result.totalPages,
        hasPreviousPage: result.page > 1,
      },
    };
  }

  @Mutation(() => UserType, { name: 'createUser' })
  async createUser(
    @Args('input') input: CreateUserInput,
  ): Promise<UserType> {
    this.logOperation('createUser', { email: input.email });
    const user = await this.userService.create(input);
    return this.mapToGraphQLUser(user);
  }

  @Mutation(() => UserType, { name: 'updateUser' })
  @UseGuards(GqlAuthGuard)
  async updateUser(
    @Args('id') id: string,
    @Args('input') input: UpdateUserInput,
  ): Promise<UserType> {
    this.logOperation('updateUser', { id, input });
    const user = await this.userService.update(id, input);
    return this.mapToGraphQLUser(user);
  }

  @Mutation(() => Boolean, { name: 'deleteUser' })
  @UseGuards(GqlAuthGuard)
  async deleteUser(@Args('id') id: string): Promise<boolean> {
    this.logOperation('deleteUser', { id });
    await this.userService.delete(id);
    return true;
  }

  private mapToGraphQLUser(user: any): UserType {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      tenantId: user.tenantId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
