import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { PrismaService } from '../../core/database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrganizationType } from '@prisma/client';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let prisma: PrismaService;

  const mockPrismaService = {
    organizations: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    permission_matrices: {
      createMany: jest.fn(),
    },
    permission_snapshots: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrganization', () => {
    it('should create an organization successfully', async () => {
      const dto = {
        name: 'Test Org',
        type: OrganizationType.SME,
      };
      const ownerId = 'owner-123';
      const mockOrg = {
        id: 'org-123',
        name: dto.name,
        type: dto.type,
        status: 'ACTIVE',
        settings: {},
        ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.organizations.findUnique.mockResolvedValue(null);
      mockPrismaService.organizations.create.mockResolvedValue(mockOrg);

      const result = await service.createOrganization(dto, ownerId);

      expect(result).toEqual(mockOrg);
      expect(mockPrismaService.organizations.findUnique).toHaveBeenCalledWith({
        where: { name: dto.name },
      });
      expect(mockPrismaService.organizations.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if organization name exists', async () => {
      const dto = {
        name: 'Existing Org',
        type: OrganizationType.SME,
      };
      const ownerId = 'owner-123';

      mockPrismaService.organizations.findUnique.mockResolvedValue({
        id: 'existing-org',
        name: dto.name,
      });

      await expect(service.createOrganization(dto, ownerId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateOrganization', () => {
    it('should update an organization successfully', async () => {
      const orgId = 'org-123';
      const dto = {
        name: 'Updated Org',
      };
      const existingOrg = {
        id: orgId,
        name: 'Old Name',
        type: OrganizationType.SME,
        status: 'ACTIVE',
        settings: {},
        ownerId: 'owner-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedOrg = { ...existingOrg, ...dto };

      mockPrismaService.organizations.findUnique
        .mockResolvedValueOnce(existingOrg)
        .mockResolvedValueOnce(null);
      mockPrismaService.organizations.update.mockResolvedValue(updatedOrg);

      const result = await service.updateOrganization(orgId, dto);

      expect(result).toEqual(updatedOrg);
      expect(mockPrismaService.organizations.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if organization does not exist', async () => {
      const orgId = 'non-existent';
      const dto = { name: 'Updated Org' };

      mockPrismaService.organizations.findUnique.mockResolvedValue(null);

      await expect(service.updateOrganization(orgId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findById', () => {
    it('should return an organization by ID', async () => {
      const orgId = 'org-123';
      const mockOrg = {
        id: orgId,
        name: 'Test Org',
        type: OrganizationType.SME,
        status: 'ACTIVE',
        settings: {},
        ownerId: 'owner-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.organizations.findUnique.mockResolvedValue(mockOrg);

      const result = await service.findById(orgId);

      expect(result).toEqual(mockOrg);
      expect(mockPrismaService.organizations.findUnique).toHaveBeenCalledWith({
        where: { id: orgId },
      });
    });

    it('should return null if organization not found', async () => {
      const orgId = 'non-existent';

      mockPrismaService.organizations.findUnique.mockResolvedValue(null);

      const result = await service.findById(orgId);

      expect(result).toBeNull();
    });
  });

  describe('initializeOwnerPermissions', () => {
    it('should create all permissions for owner', async () => {
      const ownerId = 'owner-123';
      const organizationId = 'org-123';

      mockPrismaService.permission_matrices.createMany.mockResolvedValue({
        count: 8,
      });
      mockPrismaService.permission_snapshots.create.mockResolvedValue({});

      await service.initializeOwnerPermissions(ownerId, organizationId);

      expect(mockPrismaService.permission_matrices.createMany).toHaveBeenCalled();
      expect(mockPrismaService.permission_snapshots.create).toHaveBeenCalled();
    });
  });
});
