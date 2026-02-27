import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { CorrelationContextService } from './correlation-context.service';

@Global()
@Module({
  providers: [LoggerService, CorrelationContextService],
  exports: [LoggerService, CorrelationContextService],
})
export class LoggingModule {}
