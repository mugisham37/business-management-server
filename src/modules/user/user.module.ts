import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { StaffProfileService } from './staff-profile.service';
import { PrismaService } from '../../core/database/prisma.service';

@Module({
  providers: [UserService, StaffProfileService, PrismaService],
  exports: [UserService, StaffProfileService],
})
export class UserModule {}
