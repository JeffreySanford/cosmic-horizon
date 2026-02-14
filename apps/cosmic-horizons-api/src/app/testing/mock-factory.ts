/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="jest" />

/**
 * Type-Safe Mock Factory Functions
 * Ensures all mocks have proper TypeScript types
 */

import type { CommentsService } from '../comments/comments.service';
import type { CommentsController } from '../comments/comments.controller';
import type { CacheService } from '../cache/cache.service';
import type { AdminLogsController } from '../controllers/admin-logs.controller';

/**
 * Type-safe repository mock factory
 */
export function createMockRepository() {
  return {
    find: jest.fn() as jest.MockedFunction<any>,
    findById: jest.fn() as jest.MockedFunction<any>,
    findOne: jest.fn() as jest.MockedFunction<any>,
    create: jest.fn() as jest.MockedFunction<any>,
    update: jest.fn() as jest.MockedFunction<any>,
    delete: jest.fn() as jest.MockedFunction<any>,
    softDelete: jest.fn() as jest.MockedFunction<any>,
    save: jest.fn() as jest.MockedFunction<any>,
  };
}

/**
 * Type-safe service mock factory with proper typing
 */
export function createMockService<T extends object>(): jest.Mocked<T> {
  return {} as jest.Mocked<T>;
}

/**
 * Helper to create typed mocks for NestJS services
 */
export function mockService<T extends object>(
  prototype: T,
): jest.Mocked<T> {
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(prototype));
  const mock: any = {};

  methods.forEach((method) => {
    if (method !== 'constructor') {
      mock[method] = jest.fn();
    }
  });

  return mock as jest.Mocked<T>;
}

/**
 * Type-safe Redis client mock
 */
export function createMockRedisClient() {
  return {
    get: jest.fn() as jest.MockedFunction<any>,
    set: jest.fn() as jest.MockedFunction<any>,
    setex: jest.fn() as jest.MockedFunction<(key: string, ttl: number, val: string) => Promise<string | null>>,
    del: jest.fn() as jest.MockedFunction<any>,
    exists: jest.fn() as jest.MockedFunction<any>,
    expire: jest.fn() as jest.MockedFunction<any>,
    ttl: jest.fn() as jest.MockedFunction<any>,
    ping: jest.fn() as jest.MockedFunction<() => Promise<string>>,
    connect: jest.fn() as jest.MockedFunction<() => Promise<void>>,
    disconnect: jest.fn() as jest.MockedFunction<() => Promise<void>>,
    quit: jest.fn() as jest.MockedFunction<() => Promise<void>>,
    on: jest.fn() as jest.MockedFunction<any>,
  };
}

/**
 * Assertion helpers with type safety
 */
export const TypeSafeAssertions = {
  /**
   * Assert that an object matches partial properties
   */
  assertPartial: <T extends object>(actual: Partial<T>, expected: Partial<T>) => {
    Object.entries(expected).forEach(([key, value]) => {
      expect((actual as any)[key]).toEqual(value);
    });
  },

  /**
   * Assert that an array of objects all have a property value
   */
  assertArrayPropertiesEqual: <T extends object>(
    arr: T[],
    prop: keyof T,
    value: any,
  ) => {
    arr.forEach((item) => {
      expect(item[prop]).toEqual(value);
    });
  },

  /**
   * Assert mock was called with arguments matching partial properties
   */
  assertMockCalledWithPartial: <T extends object>(
    mock: jest.MockedFunction<any>,
    index: number,
    expected: Partial<T>,
  ) => {
    const calls = mock.mock.calls[index];
    if (!calls) {
      throw new Error(`Mock was not called with index ${index}`);
    }
    const actual = calls[0];
    Object.entries(expected).forEach(([key, value]) => {
      expect((actual as any)[key]).toEqual(value);
    });
  },
};

/**
 * Domain-specific mock factories with strong typing
 */

/**
 * Create a strongly-typed mock for CommentsService
 * Provides all service methods as jest mocks with proper type checking
 */
export function createMockCommentsService(): jest.Mocked<CommentsService> {
  return {
    getCommentsByPost: jest.fn(),
    createComment: jest.fn(),
    updateComment: jest.fn(),
    deleteComment: jest.fn(),
    reportComment: jest.fn(),
    hideComment: jest.fn(),
    unhideComment: jest.fn(),
    getAllReports: jest.fn(),
    resolveReport: jest.fn(),
  } as unknown as jest.Mocked<CommentsService>;
}

/**
 * Create a strongly-typed mock for CommentsController
 * Provides all controller methods as jest mocks with proper type checking
 */
export function createMockCommentsController(): jest.Mocked<CommentsController> {
  return {
    getComments: jest.fn(),
    createComment: jest.fn(),
    updateComment: jest.fn(),
    deleteComment: jest.fn(),
    reportComment: jest.fn(),
    hideComment: jest.fn(),
    unhideComment: jest.fn(),
    getAllReports: jest.fn(),
    resolveReport: jest.fn(),
  } as unknown as jest.Mocked<CommentsController>;
}

/**
 * Create a strongly-typed mock for CacheService
 * Provides all caching methods with strong type checking
 */
export function createMockCacheService(): jest.Mocked<CacheService> {
  return {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    clear: jest.fn(),
    has: jest.fn(),
    setex: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  } as unknown as jest.Mocked<CacheService>;
}

/**
 * Create a strongly-typed mock for AdminLogsController
 * Provides all admin controller methods as jest mocks
 */
export function createMockAdminLogsController(): jest.Mocked<AdminLogsController> {
  return {
    list: jest.fn(),
    getStats: jest.fn(),
    search: jest.fn(),
    summary: jest.fn(),
  } as unknown as jest.Mocked<AdminLogsController>;
}
