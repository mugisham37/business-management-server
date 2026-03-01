import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { HierarchyLevel, UserStatus } from '@prisma/client';
import { CreateManagerDto, CreateWorkerDto, UpdateUserDto } from './dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a manager (owner only)
   * Requirements: 4.1, 4.5, 4.6
   */
  async createManager(
    dto: CreateManagerDto,
    creatorId: string,
  ): Promise<any> {
    // Get creator to validate hierarchy
    const creator = await this.findById(creatorId);
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    // Validate user creation rules
    await this.validateUserCreation(creator, HierarchyLevel.MANAGER);

    // Check if user already exists
    const existingUser = await this.findByEmailAndOrg(
      dto.email,
      dto.organizationId,
    );
    if (existingUser) {
      throw new BadRequestException(
        'User with this email already exists in the organization',
      );
    }

    // Validate branch/department assignment
    if (!dto.branchId && !dto.departmentId) {
      throw new BadRequestException(
        'Manager must be assigned to a branch or department',
      );
    }

    // Generate temporary password
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    // Create user and staff profile in transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.users.create({
        data: {
          id: randomBytes(16).toString('hex'),
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          passwordHash,
          organizationId: dto.organizationId,
          hierarchyLevel: HierarchyLevel.MANAGER,
          status: UserStatus.ACTIVE,
          createdById: creatorId,
          branchId: dto.branchId,
          departmentId: dto.departmentId,
          updatedAt: new Date(),
        },
        include: {
          staff_profiles: true,
        },
      });

      // Create staff profile
      await tx.staff_profiles.create({
        data: {
          id: randomBytes(16).toString('hex'),
          userId: newUser.id,
          fullName: dto.staffProfile.fullName,
          positionTitle: dto.staffProfile.positionTitle,
          employeeCode: dto.staffProfile.employeeCode,
          hireDate: dto.staffProfile.hireDate,
          updatedAt: new Date(),
        },
      });

      return newUser;
    });

    return {
      user,
      temporaryPassword,
    };
  }

  /**
   * Create a worker (manager only)
   * Requirements: 4.2, 4.5, 4.6
   */
  async createWorker(
    dto: CreateWorkerDto,
    creatorId: string,
  ): Promise<any> {
    // Get creator to validate hierarchy and inherit scope
    const creator = await this.findById(creatorId);
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    // Validate user creation rules
    await this.validateUserCreation(creator, HierarchyLevel.WORKER);

    // Check if user already exists
    const existingUser = await this.findByEmailAndOrg(
      dto.email,
      dto.organizationId,
    );
    if (existingUser) {
      throw new BadRequestException(
        'User with this email already exists in the organization',
      );
    }

    // Worker inherits manager's scope (Requirement 4.2)
    const branchId = creator.branchId;
    const departmentId = creator.departmentId;

    // Generate temporary password or PIN
    let passwordHash: string | null = null;
    let pinHash: string | null = null;
    let temporaryCredential: string;

    if (dto.usePIN) {
      temporaryCredential = this.generateTemporaryPIN();
      pinHash = await bcrypt.hash(temporaryCredential, 10);
    } else {
      temporaryCredential = this.generateTemporaryPassword();
      passwordHash = await bcrypt.hash(temporaryCredential, 10);
    }

    // Create user and staff profile in transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.users.create({
        data: {
          id: randomBytes(16).toString('hex'),
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          passwordHash,
          pinHash,
          organizationId: dto.organizationId,
          hierarchyLevel: HierarchyLevel.WORKER,
          status: UserStatus.ACTIVE,
          createdById: creatorId,
          branchId,
          departmentId,
          updatedAt: new Date(),
        },
        include: {
          staff_profiles: true,
        },
      });

      // Create staff profile (Requirement 4.3)
      await tx.staff_profiles.create({
        data: {
          id: randomBytes(16).toString('hex'),
          userId: newUser.id,
          fullName: dto.staffProfile.fullName,
          positionTitle: dto.staffProfile.positionTitle,
          employeeCode: dto.staffProfile.employeeCode,
          hireDate: dto.staffProfile.hireDate,
          reportsToUserId: creatorId,
          updatedAt: new Date(),
        },
      });

      return newUser;
    });

    return {
      user,
      temporaryCredential,
      credentialType: dto.usePIN ? 'PIN' : 'password',
    };
  }

  /**
   * Validate hierarchy rules for user creation
   * Requirements: 4.5, 4.6
   */
  async validateUserCreation(
    creator: any,
    targetHierarchyLevel: HierarchyLevel,
  ): Promise<void> {
    // Workers cannot create any users (Requirement 4.5)
    if (creator.hierarchyLevel === HierarchyLevel.WORKER) {
      throw new ForbiddenException('Workers cannot create users');
    }

    // Managers can only create workers (Requirement 4.6)
    if (
      creator.hierarchyLevel === HierarchyLevel.MANAGER &&
      targetHierarchyLevel !== HierarchyLevel.WORKER
    ) {
      throw new ForbiddenException('Managers can only create workers');
    }

    // Owners can create managers
    if (
      creator.hierarchyLevel === HierarchyLevel.OWNER &&
      targetHierarchyLevel === HierarchyLevel.MANAGER
    ) {
      return;
    }

    // If we reach here with invalid combination, throw error
    if (
      creator.hierarchyLevel === HierarchyLevel.OWNER &&
      targetHierarchyLevel !== HierarchyLevel.MANAGER
    ) {
      throw new BadRequestException('Owners can only create managers');
    }
  }

  /**
   * Update user details
   * Requirement: 4.1
   */
  async updateUser(userId: string, dto: UpdateUserDto): Promise<any> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.users.update({
      where: { id: userId },
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        status: dto.status,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        updatedAt: new Date(),
      },
      include: {
        staff_profiles: true,
      },
    });
  }

  /**
   * Find user by ID with relations
   * Requirement: 4.1
   */
  async findById(userId: string): Promise<any> {
    return this.prisma.users.findUnique({
      where: { id: userId },
      include: {
        staff_profiles: true,
        branches: true,
        departments: true,
      },
    });
  }

  /**
   * Find user by email and organization
   * Requirement: 4.1
   */
  async findByEmailAndOrg(
    email: string,
    organizationId: string,
  ): Promise<any> {
    return this.prisma.users.findUnique({
      where: {
        email_organizationId: {
          email,
          organizationId,
        },
      },
      include: {
        staff_profiles: true,
      },
    });
  }

  /**
   * Generate temporary password (8 characters, mixed case, numbers, special chars)
   */
  private generateTemporaryPassword(): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const all = uppercase + lowercase + numbers + special;

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    for (let i = 4; i < 12; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }

    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  /**
   * Generate temporary PIN (6 digits)
   */
  private generateTemporaryPIN(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
