import { registerAs } from '@nestjs/config';

/**
 * API configuration
 * Provides settings for GraphQL and gRPC API layers
 */
export default registerAs('api', () => ({
  graphql: {
    enabled: process.env.GRAPHQL_ENABLED !== 'false',
    playground: process.env.GRAPHQL_PLAYGROUND !== 'false',
    introspection: process.env.GRAPHQL_INTROSPECTION !== 'false',
  },
  grpc: {
    enabled: process.env.GRPC_ENABLED !== 'false',
    url: process.env.GRPC_URL || '0.0.0.0:5000',
  },
}));
