import { Observable } from 'rxjs';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface GetUserRequest {
  id: string;
}

export interface GetUserByEmailRequest {
  email: string;
}

export interface ListUsersRequest {
  pagination?: {
    page: number;
    limit: number;
    sort_by?: string;
    sort_order?: string;
  };
}

export interface ListUsersResponse {
  users: User[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface CreateUserRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  tenant_id: string;
}

export interface UpdateUserRequest {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
}

export interface DeleteUserRequest {
  id: string;
}

export interface UserResponse {
  user: User;
}

export interface SuccessResponse {
  success: boolean;
  message: string;
}

export interface IUserService {
  getUser(data: GetUserRequest): Promise<UserResponse> | Observable<UserResponse>;
  getUserByEmail(data: GetUserByEmailRequest): Promise<UserResponse> | Observable<UserResponse>;
  listUsers(data: ListUsersRequest): Promise<ListUsersResponse> | Observable<ListUsersResponse>;
  createUser(data: CreateUserRequest): Promise<UserResponse> | Observable<UserResponse>;
  updateUser(data: UpdateUserRequest): Promise<UserResponse> | Observable<UserResponse>;
  deleteUser(data: DeleteUserRequest): Promise<SuccessResponse> | Observable<SuccessResponse>;
}
