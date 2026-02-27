import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as crypto from 'crypto';

/**
 * API Key Service
 * Manages API key authentication for service-to-service calls
 */
@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate API key
   * @param apiKey API key to validate
   * @returns True if API key is valid
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    if (!apiKey) {
      return false;
    }

    // Hash the API key for comparison
    const hashedKey = this.hashApiKey(apiKey);

    // Check if API key exists in system config
    const config = await this.prisma.systemConfig.findFirst({
      where: {
        key: `api_key:${hashedKey}`,
        deletedAt: null,
      },
    });

    if (!config) {
      return false;
    }

    // Check if API key is active
    const keyData = config.value as any;
    return keyData.isActive === true;
  }

  /**
   * Generate a new API key
   * @param name API key name/description
   * @param metadata Additional metadata
   * @returns Generated API key (plain text - only shown once)
   */
  async generateApiKey(
    name: string,
    metadata?: Record<string, any>,
  ): Promise<string> {
    // Generate random API key
    const apiKey = this.generateRandomKey();
    const hashedKey = this.hashApiKey(apiKey);

    // Store hashed API key in system config
    await this.prisma.systemConfig.create({
      data: {
        key: `api_key:${hashedKey}`,
        value: {
          name,
          isActive: true,
          createdAt: new Date().toISOString(),
          metadata: metadata || {},
        },
        description: `API Key: ${name}`,
        isPublic: false,
      },
    });

    return apiKey;
  }

  /**
   * Revoke API key
   * @param apiKey API key to revoke
   */
  async revokeApiKey(apiKey: string): Promise<void> {
    const hashedKey = this.hashApiKey(apiKey);

    const config = await this.prisma.systemConfig.findFirst({
      where: {
        key: `api_key:${hashedKey}`,
        deletedAt: null,
      },
    });

    if (config) {
      const keyData = config.value as any;
      await this.prisma.systemConfig.update({
        where: { id: config.id },
        data: {
          value: {
            ...keyData,
            isActive: false,
            revokedAt: new Date().toISOString(),
          },
        },
      });
    }
  }

  /**
   * List all API keys (returns metadata only, not the keys themselves)
   * @returns List of API key metadata
   */
  async listApiKeys(): Promise<any[]> {
    const configs = await this.prisma.systemConfig.findMany({
      where: {
        key: {
          startsWith: 'api_key:',
        },
        deletedAt: null,
      },
    });

    return configs.map((config) => ({
      id: config.id,
      name: (config.value as any).name,
      isActive: (config.value as any).isActive,
      createdAt: (config.value as any).createdAt,
      metadata: (config.value as any).metadata,
    }));
  }

  /**
   * Generate random API key
   * @returns Random API key string
   */
  private generateRandomKey(): string {
    return `sk_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Hash API key for storage
   * @param apiKey Plain text API key
   * @returns Hashed API key
   */
  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }
}
