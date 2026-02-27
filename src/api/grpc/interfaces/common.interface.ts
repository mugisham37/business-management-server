// Common gRPC message interfaces

export interface PaginationRequest {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface GrpcError {
  code: string;
  message: string;
  details?: Record<string, string>;
  timestamp: string;
  correlationId?: string;
}

export interface Empty {}

export interface IdRequest {
  id: string;
}

export interface SuccessResponse {
  success: boolean;
  message?: string;
}

export interface AuditFields {
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface TenantContext {
  tenantId: string;
}
