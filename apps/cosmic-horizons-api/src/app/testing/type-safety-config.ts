/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="jest" />

/**
 * TypeScript Configuration for Type-Safe Tests
 * Enables strict type checking across test suites
 */

import type { JestConfigWithTsJest } from 'ts-jest';

/**
 * Strict TypeScript configuration for tests
 * Ensures complete type safety in test code
 */
export const strictTestTypescriptConfig: Partial<JestConfigWithTsJest> = {
  // Global setup
  globals: {
    'ts-jest': {
      tsconfig: {
        // Strict type checking options
        strict: true,
        noImplicitAny: true,
        strictNullChecks: true,
        strictFunctionTypes: true,
        strictBindCallApply: true,
        strictPropertyInitialization: true,
        noImplicitThis: true,
        alwaysStrict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        noUncheckedIndexedAccess: true,
        noPropertyAccessFromIndexSignature: true,

        // Module resolution
        moduleResolution: 'node',
        resolveJsonModule: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,

        // Declaration files
        declaration: false,
        declarationMap: false,
        sourceMap: true,
      },
    },
  },
};

/**
 * Type assertion helpers - prevents 'any' type usage in tests
 */
export const typeAssertionHelpers = {
  /**
   * Ensures the value is not 'any' type
   */
  assertNotAny: <T>(value: T): void => {
    if (value === undefined) {
      throw new Error('Value is undefined - type may be any');
    }
  },

  /**
   * Ensures multiple values are all properly typed
   */
  assertAllTyped: <T extends object>(...values: T[]): void => {
    values.forEach((val) => {
      if (val === undefined || val === null) {
        throw new Error('Null or undefined value found');
      }
    });
  },

  /**
   * Type guard for specific property existence
   */
  hasProperty: <T extends object, K extends PropertyKey>(
    obj: T,
    prop: K,
  ): obj is T & Record<K, unknown> => {
    return prop in obj;
  },
};

/**
 * Mock type helpers
 */
export const mockTypeHelpers = {
  /**
   * Creates a mock function with strong typing
   */
  createTypedMock: <T extends (...args: any[]) => any>(
    impl?: T,
  ): jest.MockedFunction<T> => {
    return jest.fn(impl) as unknown as jest.MockedFunction<T>;
  },

  /**
   * Creates a mock object with strong typing
   */
  createTypedMockObject: <T extends object>(overrides?: Partial<T>): T => {
    return (overrides || {}) as T;
  },

  /**
   * Verifies mock call with type safety
   */
  assertMockCalledWith: <T extends (...args: any[]) => any>(
    mock: jest.MockedFunction<T>,
    args: Parameters<T>,
  ): void => {
    expect(mock).toHaveBeenCalledWith(...args);
  },
};

/**
 * Test data type safety checklist
 * Use this to validate test data structures
 */
export class TestDataTypeChecker {
  static validateEntity<T extends Record<string, any>>(
    entity: T,
    requiredFields: (keyof T)[],
  ): void {
    const missing = requiredFields.filter((field) => !(field in entity));
    if (missing.length > 0) {
      throw new TypeError(
        `Required fields missing from entity: ${String(missing.join(', '))}`,
      );
    }
  }

  static validateEntityArray<T extends Record<string, any>>(
    entities: T[],
    requiredFields: (keyof T)[],
  ): void {
    entities.forEach((entity, idx) => {
      const missing = requiredFields.filter((field) => !(field in entity));
      if (missing.length > 0) {
        throw new TypeError(
          `Required fields missing from entity[${idx}]: ${String(
            missing.join(', '),
          )}`,
        );
      }
    });
  }

  static assertEnumValue<T>(
    value: unknown,
    enumValues: T[],
    enumName: string,
  ): value is T {
    if (!enumValues.includes(value as T)) {
      throw new TypeError(
        `Invalid ${enumName} value: ${String(value)}. ` +
          `Expected one of: ${enumValues.join(', ')}`,
      );
    }
    return true;
  }

  static assertRecordStructure<T extends Record<K, V>, K extends string, V>(
    record: T,
    keyType: 'string' | 'number',
    valueType: 'string' | 'number' | 'object' | 'function',
  ): void {
    Object.entries(record).forEach(([key, value]) => {
      if (keyType === 'string' && typeof key !== 'string') {
        throw new TypeError(`Record key is not a string: ${String(key)}`);
      }
      if (valueType === 'object' && typeof value !== 'object') {
        throw new TypeError(
          `Record value for key ${key} is not an object: ${typeof value}`,
        );
      }
    });
  }
}

/**
 * Builder validation helper
 * Ensures builders create complete objects
 */
export class BuilderTypeValidator<T extends Record<string, any>> {
  constructor(private requiredFields: (keyof T)[]) {}

  validate(builtObject: T): void {
    const missing = this.requiredFields.filter(
      (field) => !(field in builtObject) || builtObject[field] === undefined,
    );
    if (missing.length > 0) {
      throw new TypeError(
        `Builder failed to set required fields: ${String(missing.join(', '))}`,
      );
    }
  }

  validateAll(objects: T[]): void {
    objects.forEach((obj, idx) => {
      try {
        this.validate(obj);
      } catch (error) {
        throw new TypeError(
          `Validation failed for object[${idx}]: ${String(error)}`,
        );
      }
    });
  }
}
