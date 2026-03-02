import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { grpcConfig } from './core/config/grpc.config';
import { ConnectionHealthService } from './core/database/connection-health.service';
import { LoggerService } from './core/logging/logger.service';

async function bootstrap() {
  // Create custom logger instance
  const logger = new LoggerService();
  logger.setContext('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: logger, // Use custom logger for NestJS internal logging
    bufferLogs: true, // Buffer logs until logger is ready
  });
  
  // Use the custom logger for the application
  app.useLogger(logger);
  
  logger.info('Starting application bootstrap...');
  
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
  const corsOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
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
  
  logger.info('Configuring gRPC microservice...');
  
  // Configure gRPC microservice
  app.connectMicroservice(grpcConfig);
  
  // Start all microservices
  await app.startAllMicroservices();
  
  logger.info('gRPC microservice started successfully');
  
  // Start HTTP server - strictly on port 3001
  const port = 3001;
  if (process.env.PORT && process.env.PORT !== '3001') {
    throw new Error('Server must run on port 3001 only. No alternative port is allowed.');
  }
  
  await app.listen(port);
  
  // Start database connection health monitoring
  const connectionHealthService = app.get(ConnectionHealthService);
  connectionHealthService.startHealthChecks();
  
  logger.info('='.repeat(60));
  logger.info(`🚀 HTTP server running on: http://localhost:${port}`);
  logger.info(`📊 GraphQL server running on: http://localhost:${port}/graphql`);
  logger.info(`🔌 gRPC server running on: ${process.env.GRPC_URL || '0.0.0.0:5000'}`);
  logger.info(`🌐 CORS enabled for origins: ${corsOrigins.join(', ')}`);
  logger.info(`📝 Log Level: ${process.env.LOG_LEVEL || 'info'}`);
  logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('='.repeat(60));
  logger.info('✅ Application is ready to accept requests');
  logger.info('='.repeat(60));
}
bootstrap();
