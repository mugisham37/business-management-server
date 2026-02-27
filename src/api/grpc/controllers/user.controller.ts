import { Controller, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { BaseGrpcController } from './base-grpc.controller';
import { UserService } from '../../../modules/user/user.service';
import type {
  GetUserRequest,
  GetUserByEmailRequest,
  ListUsersRequest,
  ListUsersResponse,
  CreateUserRequest,
  UpdateUserRequest,
  DeleteUserRequest,
  UserResponse,
  SuccessResponse,
  User as GrpcUser,
} from '../interfaces/user.interface';
import type { User } from '@prisma/client';

@Controller()
export class UserGrpcController extends BaseGrpcController {
  constructor(private readonly userService: UserService) {
    super('UserGrpcController');
  }

  @GrpcMethod('UserService', 'GetUser')
  async getUser(data: GetUserRequest): Promise<UserResponse> {
    this.logRequest('GetUser', data);
    this.validateRequired(data, ['id']);

    const user = await this.userService.findById(data.id);
    return {
      user: this.mapToGrpcUser(user),
    };
  }

  @GrpcMethod('UserService', 'GetUserByEmail')
  async getUserByEmail(data: GetUserByEmailRequest): Promise<UserResponse> {
    this.logRequest('GetUserByEmail', data);
    this.validateRequired(data, ['email']);

    const user = await this.userService.findByEmail(data.email);
    if (!user) {
      this.handleError(new Error('User not found'));
    }

    return {
      user: this.mapToGrpcUser(user!),
    };
  }

  @GrpcMethod('UserService', 'ListUsers')
  async listUsers(data: ListUsersRequest): Promise<ListUsersResponse> {
    this.logRequest('ListUsers', data);

    const page = data.pagination?.page || 1;
    const limit = data.pagination?.limit || 10;
    const sortBy = data.pagination?.sort_by || 'createdAt';
    const sortOrder = data.pagination?.sort_order || 'desc';

    const result = await this.userService.findAll({
      page,
      limit,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    return {
      users: result.data.map((user) => this.mapToGrpcUser(user)),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        total_pages: result.totalPages,
        has_next: result.page < result.totalPages,
        has_prev: result.page > 1,
      },
    };
  }

  @GrpcMethod('UserService', 'CreateUser')
  async createUser(data: CreateUserRequest): Promise<UserResponse> {
    this.logRequest('CreateUser', { ...data, password: '***' });
    this.validateRequired(data, ['email', 'password', 'first_name', 'last_name', 'tenant_id']);

    const user = await this.userService.create({
      email: data.email,
      password: data.password,
      firstName: data.first_name,
      lastName: data.last_name,
      tenantId: data.tenant_id,
    });

    return {
      user: this.mapToGrpcUser(user),
    };
  }

  @GrpcMethod('UserService', 'UpdateUser')
  async updateUser(data: UpdateUserRequest): Promise<UserResponse> {
    this.logRequest('UpdateUser', data);
    this.validateRequired(data, ['id']);

    const updateData: any = {};
    if (data.email !== undefined) updateData.email = data.email;
    if (data.first_name !== undefined) updateData.firstName = data.first_name;
    if (data.last_name !== undefined) updateData.lastName = data.last_name;
    if (data.is_active !== undefined) updateData.isActive = data.is_active;

    const user = await this.userService.update(data.id, updateData);

    return {
      user: this.mapToGrpcUser(user),
    };
  }

  @GrpcMethod('UserService', 'DeleteUser')
  async deleteUser(data: DeleteUserRequest): Promise<SuccessResponse> {
    this.logRequest('DeleteUser', data);
    this.validateRequired(data, ['id']);

    await this.userService.delete(data.id);

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }

  private mapToGrpcUser(user: User): GrpcUser {
    return {
      id: user.id,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      is_active: user.isActive,
      tenant_id: user.tenantId,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
    };
  }
}
