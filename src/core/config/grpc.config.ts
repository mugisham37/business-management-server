import { Transport, GrpcOptions } from '@nestjs/microservices';
import { join } from 'path';

export const grpcConfig: GrpcOptions = {
  transport: Transport.GRPC,
  options: {
    package: ['common', 'health'],
    protoPath: [
      join(__dirname, '../../../proto/common/common.proto'),
      join(__dirname, '../../../proto/common/health.proto'),
    ],
    url: process.env.GRPC_URL || '0.0.0.0:5000',
    loader: {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    },
  },
};
