import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { grpcConfig } from './core/config/grpc.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configure gRPC microservice
  app.connectMicroservice(grpcConfig);
  
  // Start all microservices
  await app.startAllMicroservices();
  
  // Start HTTP server
  await app.listen(process.env.PORT ?? 3000);
  
  console.log(`HTTP server running on: http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`gRPC server running on: ${process.env.GRPC_URL || '0.0.0.0:5000'}`);
}
bootstrap();
