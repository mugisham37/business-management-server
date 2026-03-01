import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { EmploymentStatus } from '@prisma/client';
import { StaffProfileDto } from './dto/create-manager.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class StaffProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create staff profile
   * Requirement: 4.3
   */
  async createProfile(
    userId: string,
    dto: StaffProfileDto,
  ): Promise<any> {
    // Verify user exists
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if profile already exists
    const existingProfile = await this.getProfile(userId);
    if (existingProfile) {
      throw new Error('Staff profile already exists for this user');
    }

    return this.prisma.staff_profiles.create({
      data: {
        id: randomBytes(16).toString('hex'),
        userId,
        fullName: dto.fullName,
        positionTitle: dto.positionTitle,
        employeeCode: dto.employeeCode,
        hireDate: dto.hireDate,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update staff profile
   * Requirement: 4.3
   */
  async updateProfile(
    userId: string,
    dto: UpdateStaffProfileDto,
  ): Promise<any> {
    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new NotFoundException('Staff profile not found');
    }

    return this.prisma.staff_profiles.update({
      where: { userId },
      data: {
        fullName: dto.fullName,
        positionTitle: dto.positionTitle,
        employeeCode: dto.employeeCode,
        reportsToUserId: dto.reportsToUserId,
        employmentStatus: dto.employmentStatus,
        hireDate: dto.hireDate,
        terminationDate: dto.terminationDate,
        metadata: dto.metadata,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get profile by user ID
   * Requirement: 4.3
   */
  async getProfile(userId: string): Promise<any> {
    return this.prisma.staff_profiles.findUnique({
      where: { userId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            hierarchyLevel: true,
            branchId: true,
            departmentId: true,
          },
        },
      },
    });
  }

  /**
   * Update employment status
   * Requirement: 4.3
   */
  async updateEmploymentStatus(
    userId: string,
    status: EmploymentStatus,
  ): Promise<void> {
    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new NotFoundException('Staff profile not found');
    }

    await this.prisma.staff_profiles.update({
      where: { userId },
      data: {
        employmentStatus: status,
        terminationDate: status === EmploymentStatus.TERMINATED ? new Date() : null,
        updatedAt: new Date(),
      },
    });
  }
}
