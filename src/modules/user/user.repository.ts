import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { BaseRepository } from '../../core/database/base.repository';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(prisma: PrismaService) {
    super(prisma, 'user');
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email, deletedAt: null });
  }

  async findActiveUsers(tenantId: string): Promise<User[]> {
    return this.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
      },
    });
  }
}
