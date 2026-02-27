// Health check gRPC message interfaces

export enum ServingStatus {
  UNKNOWN = 0,
  SERVING = 1,
  NOT_SERVING = 2,
  SERVICE_UNKNOWN = 3,
}

export enum ComponentHealthStatus {
  UNKNOWN = 0,
  HEALTHY = 1,
  UNHEALTHY = 2,
  DEGRADED = 3,
}

export interface HealthCheckRequest {
  service?: string;
}

export interface ComponentHealth {
  status: ComponentHealthStatus;
  message?: string;
  details?: Record<string, string>;
}

export interface HealthCheckResponse {
  status: ServingStatus;
  components?: Record<string, ComponentHealth>;
  timestamp: string;
}
