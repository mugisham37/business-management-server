/**
 * User Factory
 * Creates test user entities with realistic data
 */

import { faker } from '@faker-js/faker';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export interface UserFactoryOptions {
  id?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  tenantId?: string;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Hash password for user creation
 */
async function hashPassword(password: string): Promise<string> {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '4', 10);
  return bcrypt.hash(password, rounds);
}

/**
 * Create user data for testing
 */
export async function createUserData(
  overrides?: UserFactoryOptions,
): Promise<Prisma.UserCreateInput> {
  const password = overrides?.password || 'Password123!';
  const hashedPassword = await hashPassword(password);

  return {
    id: overrides?.id || faker.string.uuid(),
    email: overrides?.email || faker.internet.email(),
    password: hashedPassword,
    firstName: overrides?.firstName || faker.person.firstName(),
    lastName: overrides?.lastName || faker.person.lastName(),
    isActive: overrides?.isActive ?? true,
    tenant: {
      connect: { id: overrides?.tenantId || 'default-tenant-id' },
    },
    createdBy: overrides?.createdBy || null,
    updatedBy: overrides?.updatedBy || null,
  };
}

/**
 * Create user data without tenant relation (for direct creation)
 */
export async function createUserDataWithoutRelation(
  tenantId: string,
  overrides?: UserFactoryOptions,
): Promise<Omit<Prisma.UserCreateInput, 'tenant'> & { tenantId: string }> {
  const password = overrides?.password || 'Password123!';
  const hashedPassword = await hashPassword(password);

  return {
    id: overrides?.id || faker.string.uuid(),
    email: overrides?.email || faker.internet.email(),
    password: hashedPassword,
    firstName: overrides?.firstName || faker.person.firstName(),
    lastName: overrides?.lastName || faker.person.lastName(),
    isActive: overrides?.isActive ?? true,
    tenantId,
    createdBy: overrides?.createdBy || null,
    updatedBy: overrides?.updatedBy || null,
  };
}

/**
 * Create a user entity (for use with Prisma)
 */
export async function createUser(
  prisma: any,
  tenantId: string,
  overrides?: UserFactoryOptions,
): Promise<User> {
  const data = await createUserDataWithoutRelation(tenantId, overrides);
  return prisma.user.create({ data });
}

/**
 * Create multiple user entities
 */
export async function createUserBatch(
  prisma: any,
  tenantId: string,
  count: number,
  overrides?: UserFactoryOptions,
): Promise<User[]> {
  const users: User[] = [];
  for (let i = 0; i < count; i++) {
    users.push(await createUser(prisma, tenantId, overrides));
  }
  return users;
}
