/**
 * Mock Helper for Service Mocking
 * Provides utilities for creating mock services and dependencies
 */

import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

export type MockType<T> = {
  [P in keyof T]?: jest.Mock<any>;
};

/**
 * Create a mock object with jest.fn() for all methods
 */
export function createMock<T>(type: new (...args: any[]) => T): MockType<T> {
  const mock: any = {};
  const prototype = type.prototype;

  Object.getOwnPropertyNames(prototype).forEach((name) => {
    if (name !== 'constructor' && typeof prototype[name] === 'function') {
      mock[name] = jest.fn();
    }
  });

  return mock;
}

/**
 * Create a partial mock with specific implementations
 */
export function createPartialMock<T>(
  implementations: Partial<T>,
): MockType<T> {
  const mock: any = {};

  Object.keys(implementations).forEach((key) => {
    const value = implementations[key as keyof T];
    if (typeof value === 'function') {
      mock[key] = jest.fn(value as any);
    } else {
      mock[key] = value;
    }
  });

  return mock;
}

/**
 * Create a mock repository with common CRUD methods
 */
export function createMockRepository<T>() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    softDelete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getOne: jest.fn(),
      getManyAndCount: jest.fn(),
    })),
  };
}

/**
 * Create a mock Prisma client
 */
export function createMockPrismaClient(): any {
  return {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn((fn) => fn(createMockPrismaClient())),
    $executeRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    user: createMockPrismaModel(),
    tenant: createMockPrismaModel(),
    role: createMockPrismaModel(),
    permission: createMockPrismaModel(),
    userRole: createMockPrismaModel(),
    rolePermission: createMockPrismaModel(),
    auditLog: createMockPrismaModel(),
    systemConfig: createMockPrismaModel(),
  };
}

/**
 * Create a mock Prisma model with common methods
 */
export function createMockPrismaModel(): any {
  return {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  };
}

/**
 * Create a mock Redis client
 */
export function createMockRedisClient() {
  return {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(),
    flushdb: jest.fn(),
    flushall: jest.fn(),
    ping: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn(),
  };
}

/**
 * Create a mock Bull queue
 */
export function createMockQueue() {
  return {
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    getJob: jest.fn(),
    getJobs: jest.fn(),
    getJobCounts: jest.fn(),
    clean: jest.fn(),
    close: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    isPaused: jest.fn(),
  };
}

/**
 * Create a mock EventEmitter
 */
export function createMockEventEmitter() {
  return {
    emit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    listeners: jest.fn(),
    listenerCount: jest.fn(),
  };
}

/**
 * Create a testing module with common test setup
 */
export async function createTestingModule(
  metadata: ModuleMetadata,
): Promise<TestingModule> {
  return Test.createTestingModule(metadata).compile();
}

/**
 * Reset all mocks in an object
 */
export function resetMocks<T>(mock: MockType<T>): void {
  Object.values(mock).forEach((fn) => {
    if (jest.isMockFunction(fn)) {
      fn.mockReset();
    }
  });
}

/**
 * Clear all mocks in an object
 */
export function clearMocks<T>(mock: MockType<T>): void {
  Object.values(mock).forEach((fn) => {
    if (jest.isMockFunction(fn)) {
      fn.mockClear();
    }
  });
}
