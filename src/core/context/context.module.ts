import { Module, Global } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

/**
 * Context Module
 * 
 * Provides request context management using AsyncLocalStorage.
 * This module is global so the RequestContextService can be injected
 * anywhere in the application.
 */
@Global()
@Module({
  providers: [RequestContextService],
  exports: [RequestContextService],
})
export class ContextModule {}
