import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { grpcConfig } from './core/config/grpc.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Security headers using Helmet
  // Requirements: 17.7, 17.9
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      frameguard: {
        action: 'deny',
      },
      noSniff: true,
      xssFilter: true,
    }),
  );

  // CORS configuration
  // Requirement: 17.7
  const corsOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
    exposedHeaders: ['X-Correlation-Id'],
    maxAge: 3600, // Cache preflight requests for 1 hour
  });

  // Request size limits to prevent DoS attacks
  // Requirement: 17.9
  app.use((req: any, res: any, next: any) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    let size = 0;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxSize) {
        res.status(413).json({
          statusCode: 413,
          message: 'Request entity too large',
          error: 'Payload Too Large',
        });
        req.connection.destroy();
      }
    });

    next();
  });
  
  // Global validation pipe for input validation
  // Requirements: 17.3, 17.4, 20.1
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
      disableErrorMessages: process.env.NODE_ENV === 'production', // Hide detailed errors in production
    }),
  );
  
  // Configure gRPC microservice
  app.connectMicroservice(grpcConfig);
  
  // Start all microservices
  await app.startAllMicroservices();
  
  // Start HTTP server
  await app.listen(process.env.PORT ?? 3000);
  
  console.log(`HTTP server running on: http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`gRPC server running on: ${process.env.GRPC_URL || '0.0.0.0:5000'}`);
  console.log(`CORS enabled for origins: ${corsOrigins.join(', ')}`);
}
bootstrap();
