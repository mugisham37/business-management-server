import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { DatabaseModule } from '../../core/database/database.module';
import { EventsModule } from '../../core/events/events.module';
import { CacheModule } from '../../core/cache/cache.module';

@Module({
  imports: [DatabaseModule, EventsModule, CacheModule],
  providers: [UserService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
