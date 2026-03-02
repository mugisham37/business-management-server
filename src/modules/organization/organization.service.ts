import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { organizations as Organization } from '@prisma/client';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { getAllPermissions } from '../../common/constants/module-registry.constant';
import { v4 as uuidv4 } from 'uuid';

/**
 * OrganizationService
 * 
 * Manages organization lifecycle and settings.
 * Handles organization creation during owner registration and permission initialization.
 */
@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create organization during owner registration
   * 
   * @param dto - Organization creation data
   * @param ownerId - ID of the owner user
   * @returns Created organization
   */
  async createOrganization(
    dto: CreateOrganizationDto,
    ownerId: string,
  ): Promise<Organization> {
    // Check if organization name already exists
    const existing = await this.prisma.organizations.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new BadRequestException('Organization name already exists');
    }

    // Create organization
    const organization = await this.prisma.organizations.create({
      data: {
        id: uuidv4(),
        name: dto.name,
        type: dto.type,
        settings: dto.settings || {},
        ownerId,
        updatedAt: new Date(),
      },
    });

    return organization;
  }

  /**
   * Initialize owner permissions
   * Grants all module permissions to the owner
   * 
   * @param ownerId - ID of the owner user
   * @param organizationId - ID of the organization
   */
  async initializeOwnerPermissions(
    ownerId: string,
    organizationId: string,
  ): Promise<void> {
    const allPermissions = getAllPermissions();

    // Create permission matrix records for all modules
    const permissionMatrices = allPermissions.map((perm) => ({
      id: uuidv4(),
      userId: ownerId,
      organizationId,
      module: perm.module,
      actions: perm.actions,
      grantedById: ownerId, // Owner grants to themselves
      // grantedAt has @default(now()) in schema
      // revokedAt is optional, defaults to null
    }));

    // Bulk create all permissions
    await this.prisma.permission_matrices.createMany({
      data: permissionMatrices,
    });

    // Create permission snapshot
    await this.prisma.permission_snapshots.create({
      data: {
        id: uuidv4(),
        userId: ownerId,
        snapshotData: {
          permissions: allPermissions,
          timestamp: new Date().toISOString(),
        },
        fingerprintHash: this.calculatePermissionFingerprint(allPermissions),
        reason: 'OWNER_INITIALIZATION',
        // createdAt has @default(now()) in schema, no need to specify
      },
    });
  }

  /**
   * Update organization settings
   * 
   * @param orgId - Organization ID
   * @param dto - Update data
   * @returns Updated organization
   */
  async updateOrganization(
    orgId: string,
    dto: UpdateOrganizationDto,
  ): Promise<Organization> {
    // Check if organization exists
    const existing = await this.findById(orgId);
    if (!existing) {
      throw new NotFoundException('Organization not found');
    }

    // If name is being updated, check uniqueness
    if (dto.name && dto.name !== existing.name) {
      const nameExists = await this.prisma.organizations.findUnique({
        where: { name: dto.name },
      });

      if (nameExists) {
        throw new BadRequestException('Organization name already exists');
      }
    }

    // Update organization
    const updated = await this.prisma.organizations.update({
      where: { id: orgId },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Get organization by ID
   * 
   * @param orgId - Organization ID
   * @returns Organization or null
   */
  async findById(orgId: string): Promise<Organization | null> {
    return this.prisma.organizations.findUnique({
      where: { id: orgId },
    });
  }

  /**
   * Calculate permission fingerprint
   * Uses SHA-256 hash of sorted permissions
   * 
   * @param permissions - Array of module permissions
   * @returns Fingerprint hash
   */
  private calculatePermissionFingerprint(
    permissions: Array<{ module: string; actions: string[] }>,
  ): string {
    const crypto = require('crypto');
    
    // Sort permissions for consistent hashing
    const sorted = permissions
      .map((p) => ({
        module: p.module,
        actions: [...p.actions].sort(),
      }))
      .sort((a, b) => a.module.localeCompare(b.module));

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(sorted))
      .digest('hex');

    return hash;
  }
}
