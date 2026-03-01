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
   * Find all users in organization
   * Requirement: 4.1
   * Note: Scope filtering is applied by Prisma middleware
   */
  async findAll(organizationId: string): Promise<any[]> {
    return this.prisma.users.findMany({
      where: {
        organizationId,
      },
      include: {
        staff_profiles: true,
        branches: true,
        departments: true,
      },
      orderBy: {
        createdAt: 'desc',
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


    /**
     * Change password with current password verification
     * Requirements: 14.1, 14.4, 14.5, 14.7
     */
    async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string,
        currentSessionId?: string,
      ): Promise<void> {
        // Get user
        const user = await this.findById(userId);
        if (!user) {
          throw new NotFoundException('User not found');
        }

        // Verify current password (Requirement 14.4)
        if (!user.passwordHash) {
          throw new BadRequestException('User does not have a password set');
        }

        const isCurrentPasswordValid = await bcrypt.compare(
          currentPassword,
          user.passwordHash,
        );
        if (!isCurrentPasswordValid) {
          throw new BadRequestException('Current password is incorrect');
        }

        // Validate new password strength (Requirement 14.1)
        this.validatePasswordStrength(newPassword);

        // Check password reuse (last 3 passwords) (Requirement 14.7)
        await this.checkPasswordReuse(userId, newPassword);

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Update password and store old password hash in staff profile metadata
        await this.prisma.$transaction(async (tx) => {
          // Get staff profile to access metadata
          const staffProfile = await tx.staff_profiles.findUnique({
            where: { userId },
            select: { metadata: true },
          });

          // Get current password history from staff profile metadata
          const passwordHistory = (staffProfile?.metadata as any)?.passwordHistory || [];

          // Add current password to history
          passwordHistory.unshift(user.passwordHash);

          // Keep only last 3 passwords
          const updatedHistory = passwordHistory.slice(0, 3);

          // Update staff profile with password history
          await tx.staff_profiles.update({
            where: { userId },
            data: {
              metadata: {
                ...(staffProfile?.metadata as any || {}),
                passwordHistory: updatedHistory,
              },
              updatedAt: new Date(),
            },
          });

          // Update user with new password
          await tx.users.update({
            where: { id: userId },
            data: {
              passwordHash: newPasswordHash,
              updatedAt: new Date(),
            },
          });

          // Revoke all sessions except current (Requirement 14.5)
          await tx.sessions.updateMany({
            where: {
              userId,
              revokedAt: null,
              ...(currentSessionId && {
                id: {
                  not: currentSessionId,
                },
              }),
            },
            data: {
              revokedAt: new Date(),
            },
          });
        });
      }

    /**
     * Set PIN with format validation
     * Requirements: 14.2, 14.3
     */
    async setPIN(userId: string, pin: string): Promise<void> {
      // Get user
      const user = await this.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Validate user is a worker (Requirement 14.2)
      if (user.hierarchyLevel !== HierarchyLevel.WORKER) {
        throw new BadRequestException('Only workers can set a PIN');
      }

      // Validate PIN format (4-6 digits) (Requirement 14.2)
      this.validatePINFormat(pin);

      // Hash PIN (Requirement 14.3)
      const pinHash = await bcrypt.hash(pin, 10);

      // Update user with PIN
      await this.prisma.users.update({
        where: { id: userId },
        data: {
          pinHash,
          updatedAt: new Date(),
        },
      });
    }

    /**
     * Validate password strength
     * Requirement 14.1: Minimum 8 characters, uppercase, lowercase, number, special character
     */
    private validatePasswordStrength(password: string): void {
      if (password.length < 8) {
        throw new BadRequestException(
          'Password must be at least 8 characters long',
        );
      }

      if (!/[A-Z]/.test(password)) {
        throw new BadRequestException(
          'Password must contain at least one uppercase letter',
        );
      }

      if (!/[a-z]/.test(password)) {
        throw new BadRequestException(
          'Password must contain at least one lowercase letter',
        );
      }

      if (!/[0-9]/.test(password)) {
        throw new BadRequestException(
          'Password must contain at least one number',
        );
      }

      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        throw new BadRequestException(
          'Password must contain at least one special character',
        );
      }
    }

    /**
     * Validate PIN format
     * Requirement 14.2: 4-6 digits only
     */
    private validatePINFormat(pin: string): void {
      if (!/^\d{4,6}$/.test(pin)) {
        throw new BadRequestException('PIN must be 4-6 digits');
      }
    }

    /**
     * Check password reuse (last 3 passwords)
     * Requirement 14.7: Prevent password reuse
     */
    private async checkPasswordReuse(
        userId: string,
        newPassword: string,
      ): Promise<void> {
        const user = await this.prisma.users.findUnique({
          where: { id: userId },
          select: {
            passwordHash: true,
            staff_profiles: {
              select: {
                metadata: true,
              },
            },
          },
        });

        if (!user) {
          return;
        }

        // Check against current password
        if (user.passwordHash) {
          const matchesCurrent = await bcrypt.compare(
            newPassword,
            user.passwordHash,
          );
          if (matchesCurrent) {
            throw new BadRequestException(
              'New password cannot be the same as current password',
            );
          }
        }

        // Check against password history from staff profile metadata
        const passwordHistory = (user.staff_profiles?.metadata as any)?.passwordHistory || [];
        for (const oldPasswordHash of passwordHistory) {
          const matchesOld = await bcrypt.compare(newPassword, oldPasswordHash);
          if (matchesOld) {
            throw new BadRequestException(
              'New password cannot be one of your last 3 passwords',
            );
          }
        }
      }

}
