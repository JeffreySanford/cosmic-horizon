import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger } from '@nestjs/common';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;
import {
  EventSchemaRegistry,
  EventSchema,
} from './event-schema-registry.service';

describe('EventSchemaRegistry', () => {
  let service: EventSchemaRegistry;

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      providers: [EventSchemaRegistry],
    }).compile();

    service = testingModule.get<EventSchemaRegistry>(EventSchemaRegistry);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerSchema', () => {
    it('should register a new schema', () => {
      const schema: EventSchema = {
        name: 'UserCreated',
        version: '1.0.0',
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'email', type: 'string', required: true },
        ],
      };

      service.registerSchema('user.created', schema);

      expect(service.getRegisteredEventTypes()).toContain('user.created');
    });

    it('should throw if eventType is missing', () => {
      const schema: EventSchema = {
        name: 'Test',
        version: '1.0.0',
        fields: [],
      };

      expect(() => service.registerSchema('', schema)).toThrow(
        BadRequestException,
      );
      expect(() => service.registerSchema(null as any, schema)).toThrow(
        BadRequestException,
      );
    });

    it('should throw if schema is missing', () => {
      expect(() => service.registerSchema('test.event', null as any)).toThrow(
        BadRequestException,
      );
    });

    it('should throw if version is invalid', () => {
      const schema: EventSchema = {
        name: 'Test',
        version: 'invalid', // Invalid semantic version
        fields: [],
      };

      expect(() => service.registerSchema('test.event', schema)).toThrow(
        BadRequestException,
      );
    });

    it('should throw if version already registered', () => {
      const schema: EventSchema = {
        name: 'Test',
        version: '1.0.0',
        fields: [],
      };

      service.registerSchema('test.event', schema);
      expect(() => service.registerSchema('test.event', schema)).toThrow(
        BadRequestException,
      );
    });

    it('should allow multiple versions of same event type', () => {
      const schema1: EventSchema = {
        name: 'Test',
        version: '1.0.0',
        fields: [{ name: 'id', type: 'string', required: true }],
      };

      const schema2: EventSchema = {
        name: 'Test',
        version: '2.0.0',
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'name', type: 'string', required: true },
        ],
      };

      service.registerSchema('test.event', schema1);
      service.registerSchema('test.event', schema2);

      expect(service.getSchemaVersions('test.event')).toHaveLength(2);
    });

    it('should validate semantic version formats', () => {
      const schema: EventSchema = {
        name: 'Test',
        version: '1.0', // Missing patch
        fields: [],
      };

      expect(() => service.registerSchema('test.event', schema)).toThrow(
        BadRequestException,
      );
    });

    it('should accept valid semantic versions', () => {
      const validVersions = ['1.0.0', '0.0.1', '10.20.30'];

      for (const version of validVersions) {
        const schema: EventSchema = {
          name: 'Test',
          version,
          fields: [],
        };
        service.registerSchema(`test.event${version}`, schema);
      }

      expect(service.getRegisteredEventTypes()).toHaveLength(3);
    });

    it('should handle registration with deprecated fields', () => {
      const schema: EventSchema = {
        name: 'Test',
        version: '2.0.0',
        fields: [{ name: 'id', type: 'string', required: true }],
        deprecatedFields: ['legacyId', 'legacyEmail'],
      };

      service.registerSchema('test.event', schema);
      expect(service.getSchema('test.event')).toHaveProperty(
        'deprecatedFields',
      );
    });
  });

  describe('getSchema', () => {
    beforeEach(() => {
      const schema1: EventSchema = {
        name: 'Test',
        version: '1.0.0',
        fields: [{ name: 'id', type: 'string', required: true }],
      };

      const schema2: EventSchema = {
        name: 'Test',
        version: '2.0.0',
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'name', type: 'string', required: false },
        ],
      };

      service.registerSchema('test.event', schema1);
      service.registerSchema('test.event', schema2);
    });

    it('should retrieve schema by version', () => {
      const schema = service.getSchema('test.event', '1.0.0');
      expect(schema.version).toBe('1.0.0');
    });

    it('should retrieve latest schema when version not specified', () => {
      const schema = service.getSchema('test.event');
      expect(schema.version).toBe('2.0.0');
    });

    it('should throw if event type not found', () => {
      expect(() => service.getSchema('unknown.event')).toThrow(
        BadRequestException,
      );
    });

    it('should throw if specific version not found', () => {
      expect(() => service.getSchema('test.event', '3.0.0')).toThrow(
        BadRequestException,
      );
    });

    it('should return latest version correctly across multiple registrations', () => {
      service.clear();

      const versions = ['1.0.0', '1.5.0', '2.0.0', '1.10.0'];
      for (const version of versions) {
        const schema: EventSchema = {
          name: 'Test',
          version,
          fields: [],
        };
        service.registerSchema('test.event', schema);
      }

      const latest = service.getSchema('test.event');
      expect(latest.version).toBe('2.0.0');
    });
  });

  describe('validateEvent', () => {
    const schema: EventSchema = {
      name: 'UserCreated',
      version: '1.0.0',
      fields: [
        { name: 'id', type: 'string', required: true },
        { name: 'email', type: 'string', required: true },
        { name: 'age', type: 'number', required: false },
        { name: 'isActive', type: 'boolean', required: true },
        {
          name: 'role',
          type: 'string',
          required: true,
          enum: ['admin', 'user', 'guest'],
        },
      ],
    };

    beforeEach(() => {
      service.registerSchema('user.created', schema);
    });

    it('should validate correct event', () => {
      const event = {
        id: 'user-1',
        email: 'test@example.com',
        isActive: true,
        role: 'user',
      };

      const errors = service.validateEvent('user.created', event);
      expect(errors).toHaveLength(0);
    });

    it('should fail for missing required field', () => {
      const event = {
        id: 'user-1',
        email: 'test@example.com',
        isActive: true,
        // Missing role
      };

      const errors = service.validateEvent('user.created', event);
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: 'role',
          error: 'Required field missing',
        }),
      );
    });

    it('should pass for missing optional field', () => {
      const event = {
        id: 'user-1',
        email: 'test@example.com',
        isActive: true,
        role: 'user',
        // age is optional and missing
      };

      const errors = service.validateEvent('user.created', event);
      expect(errors).toHaveLength(0);
    });

    it('should fail for invalid type', () => {
      const event = {
        id: 'user-1',
        email: 'test@example.com',
        isActive: 'true', // Should be boolean
        role: 'user',
      };

      const errors = service.validateEvent('user.created', event);
      expect(errors.some((e) => e.field === 'isActive')).toBe(true);
    });

    it('should fail for invalid enum value', () => {
      const event = {
        id: 'user-1',
        email: 'test@example.com',
        isActive: true,
        role: 'superuser', // Invalid enum value
      };

      const errors = service.validateEvent('user.created', event);
      expect(errors).toContainEqual(
        expect.objectContaining({
          field: 'role',
          error: expect.stringContaining('admin, user, guest'),
        }),
      );
    });

    it('should validate with optional field present and valid', () => {
      const event = {
        id: 'user-1',
        email: 'test@example.com',
        age: 25,
        isActive: true,
        role: 'user',
      };

      const errors = service.validateEvent('user.created', event);
      expect(errors).toHaveLength(0);
    });

    it('should fail for type mismatch on optional field', () => {
      const event = {
        id: 'user-1',
        email: 'test@example.com',
        age: 'twenty-five', // Should be number
        isActive: true,
        role: 'user',
      };

      const errors = service.validateEvent('user.created', event);
      expect(errors.some((e) => e.field === 'age')).toBe(true);
    });

    it('should validate null as missing optional field', () => {
      const event = {
        id: 'user-1',
        email: 'test@example.com',
        age: null,
        isActive: true,
        role: 'user',
      };

      const errors = service.validateEvent('user.created', event);
      expect(errors).toHaveLength(0);
    });

    it('should throw if event type not registered', () => {
      expect(() => service.validateEvent('unknown.event', {})).toThrow(
        BadRequestException,
      );
    });

    it('should validate specific version', () => {
      const event = {
        id: 'user-1',
        email: 'test@example.com',
        isActive: true,
        role: 'user',
      };

      const errors = service.validateEvent('user.created', event, '1.0.0');
      expect(errors).toHaveLength(0);
    });
  });

  describe('validateEvent - type validation', () => {
    beforeEach(() => {
      const schema: EventSchema = {
        name: 'TypeTest',
        version: '1.0.0',
        fields: [
          { name: 'strVal', type: 'string', required: true },
          { name: 'numVal', type: 'number', required: true },
          { name: 'boolVal', type: 'boolean', required: true },
          { name: 'dateVal', type: 'date', required: true },
          { name: 'objVal', type: 'object', required: true },
          { name: 'arrVal', type: 'array', required: true },
        ],
      };

      service.registerSchema('type.test', schema);
    });

    it('should validate string type', () => {
      const event = {
        strVal: 'test',
        numVal: 1,
        boolVal: true,
        dateVal: new Date(),
        objVal: { key: 'value' },
        arrVal: [],
      };

      const errors = service.validateEvent('type.test', event);
      expect(errors).toHaveLength(0);
    });

    it('should validate date as ISO string', () => {
      const event = {
        strVal: 'test',
        numVal: 1,
        boolVal: true,
        dateVal: '2026-02-12T00:00:00Z',
        objVal: { key: 'value' },
        arrVal: [],
      };

      const errors = service.validateEvent('type.test', event);
      expect(errors).toHaveLength(0);
    });

    it('should fail for NaN number', () => {
      const event = {
        strVal: 'test',
        numVal: NaN,
        boolVal: true,
        dateVal: new Date(),
        objVal: { key: 'value' },
        arrVal: [],
      };

      const errors = service.validateEvent('type.test', event);
      expect(errors.some((e) => e.field === 'numVal')).toBe(true);
    });

    it('should fail for null object field', () => {
      const event = {
        strVal: 'test',
        numVal: 1,
        boolVal: true,
        dateVal: new Date(),
        objVal: null,
        arrVal: [],
      };

      const errors = service.validateEvent('type.test', event);
      expect(errors.some((e) => e.field === 'objVal')).toBe(true);
    });

    it('should fail if array is object', () => {
      const event = {
        strVal: 'test',
        numVal: 1,
        boolVal: true,
        dateVal: new Date(),
        objVal: { key: 'value' },
        arrVal: { 0: 'value' },
      };

      const errors = service.validateEvent('type.test', event);
      expect(errors.some((e) => e.field === 'arrVal')).toBe(true);
    });
  });

  describe('isCompatible', () => {
    beforeEach(() => {
      const v1: EventSchema = {
        name: 'Test',
        version: '1.0.0',
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'name', type: 'string', required: true },
        ],
      };

      const v2: EventSchema = {
        name: 'Test',
        version: '2.0.0',
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'name', type: 'string', required: true },
          {
            name: 'email',
            type: 'string',
            required: false,
            default: 'unknown@example.com',
          },
        ],
      };

      const v3Incompatible: EventSchema = {
        name: 'Test',
        version: '3.0.0',
        fields: [{ name: 'id', type: 'string', required: true }], // Removed required field
      };

      service.registerSchema('test.event', v1);
      service.registerSchema('test.event', v2);
      service.registerSchema('test.event', v3Incompatible);
    });

    it('should return true for same version', () => {
      const compatible = service.isCompatible('test.event', '1.0.0', '1.0.0');
      expect(compatible).toBe(true);
    });

    it('should return true for forward-compatible upgrade', () => {
      const compatible = service.isCompatible('test.event', '1.0.0', '2.0.0');
      expect(compatible).toBe(true);
    });

    it('should return false for incompatible versions', () => {
      const compatible = service.isCompatible('test.event', '1.0.0', '3.0.0');
      expect(compatible).toBe(false);
    });

    it('should return false if event type not registered', () => {
      const compatible = service.isCompatible(
        'unknown.event',
        '1.0.0',
        '2.0.0',
      );
      expect(compatible).toBe(false);
    });

    it('should return false if old version not found', () => {
      const compatible = service.isCompatible('test.event', '99.0.0', '2.0.0');
      expect(compatible).toBe(false);
    });
  });

  describe('getSchemaVersions', () => {
    beforeEach(() => {
      service.clear();

      const versions = ['1.0.0', '2.0.0', '1.5.0'];
      for (const version of versions) {
        const schema: EventSchema = {
          name: 'Test',
          version,
          fields: [],
        };
        service.registerSchema('test.event', schema);
      }
    });

    it('should return all versions sorted in ascending order', () => {
      const versions = service.getSchemaVersions('test.event');
      expect(versions).toEqual(['1.0.0', '1.5.0', '2.0.0']);
    });

    it('should throw if event type not registered', () => {
      expect(() => service.getSchemaVersions('unknown.event')).toThrow(
        BadRequestException,
      );
    });

    it('should return single version', () => {
      const schema: EventSchema = {
        name: 'Single',
        version: '1.0.0',
        fields: [],
      };

      service.clear();
      service.registerSchema('single.event', schema);

      const versions = service.getSchemaVersions('single.event');
      expect(versions).toEqual(['1.0.0']);
    });
  });

  describe('getRegisteredEventTypes', () => {
    it('should return empty array initially', () => {
      service.clear();
      expect(service.getRegisteredEventTypes()).toEqual([]);
    });

    it('should return all registered event types', () => {
      const schema: EventSchema = {
        name: 'Test',
        version: '1.0.0',
        fields: [],
      };

      service.registerSchema('user.created', schema);
      service.registerSchema('user.updated', schema);
      service.registerSchema('post.deleted', schema);

      const eventTypes = service.getRegisteredEventTypes();
      expect(eventTypes).toHaveLength(3);
      expect(eventTypes).toContain('user.created');
      expect(eventTypes).toContain('user.updated');
      expect(eventTypes).toContain('post.deleted');
    });
  });

  describe('clear', () => {
    it('should clear all registered schemas', () => {
      const schema: EventSchema = {
        name: 'Test',
        version: '1.0.0',
        fields: [],
      };

      service.registerSchema('test.event', schema);
      expect(service.getRegisteredEventTypes()).toHaveLength(1);

      service.clear();
      expect(service.getRegisteredEventTypes()).toHaveLength(0);
    });

    it('should allow re-registering after clear', () => {
      const schema: EventSchema = {
        name: 'Test',
        version: '1.0.0',
        fields: [],
      };

      service.registerSchema('test.event', schema);
      service.clear();
      service.registerSchema('test.event', schema);

      expect(service.getRegisteredEventTypes()).toHaveLength(1);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle schema with no fields', () => {
      const schema: EventSchema = {
        name: 'Empty',
        version: '1.0.0',
        fields: [],
      };

      service.registerSchema('empty.event', schema);
      const errors = service.validateEvent('empty.event', {});
      expect(errors).toHaveLength(0);
    });

    it('should handle event with extra fields not in schema', () => {
      const schema: EventSchema = {
        name: 'Test',
        version: '1.0.0',
        fields: [{ name: 'id', type: 'string', required: true }],
      };

      service.registerSchema('test.event', schema);

      const event = {
        id: 'test-1',
        extraField: 'should be ignored',
        anotherExtra: 123,
      };

      const errors = service.validateEvent('test.event', event);
      expect(errors).toHaveLength(0);
    });

    it('should handle multiple validation errors', () => {
      const schema: EventSchema = {
        name: 'Test',
        version: '1.0.0',
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'email', type: 'string', required: true },
          { name: 'age', type: 'number', required: true },
        ],
      };

      service.registerSchema('test.event', schema);

      const event = {
        id: 123, // Wrong type
        email: undefined, // Missing required
        age: 'invalid', // Wrong type
      };

      const errors = service.validateEvent('test.event', event);
      expect(errors.length).toBeGreaterThan(1);
    });

    it('should handle schema with default values', () => {
      const schema: EventSchema = {
        name: 'Test',
        version: '1.0.0',
        fields: [
          { name: 'id', type: 'string', required: true },
          {
            name: 'status',
            type: 'string',
            required: true,
            enum: ['active', 'inactive'],
            default: 'active',
          },
        ],
      };

      service.registerSchema('test.event', schema);
      expect(service.getSchema('test.event')).toBeDefined();
    });

    it('should validate events with fields indicating defaults', () => {
      const v1: EventSchema = {
        name: 'Test',
        version: '1.0.0',
        fields: [{ name: 'id', type: 'string', required: true }],
      };

      const v2: EventSchema = {
        name: 'Test',
        version: '2.0.0',
        fields: [
          { name: 'id', type: 'string', required: true },
          {
            name: 'newField',
            type: 'string',
            required: true,
            default: 'default-value',
          },
        ],
      };

      service.registerSchema('test.event', v1);
      service.registerSchema('test.event', v2);

      const isCompatible = service.isCompatible('test.event', '1.0.0', '2.0.0');
      expect(isCompatible).toBe(true);
    });
  });

  describe('Version sorting', () => {
    it('should correctly sort various semantic versions', () => {
      service.clear();

      const unsortedVersions = [
        '10.0.0',
        '2.0.0',
        '1.10.0',
        '1.2.0',
        '1.2.10',
        '0.0.1',
      ];
      for (const version of unsortedVersions) {
        const schema: EventSchema = {
          name: 'Test',
          version,
          fields: [],
        };
        service.registerSchema('test.event', schema);
      }

      const sortedVersions = service.getSchemaVersions('test.event');
      expect(sortedVersions).toEqual([
        '0.0.1',
        '1.2.0',
        '1.2.10',
        '1.10.0',
        '2.0.0',
        '10.0.0',
      ]);
    });
  });

  describe('Forward compatibility checking', () => {
    it('should allow field type change if compatible', () => {
      const v1: EventSchema = {
        name: 'Test',
        version: '1.0.0',
        fields: [{ name: 'id', type: 'string', required: true }],
      };

      // Cannot change type in v2
      const v2: EventSchema = {
        name: 'Test',
        version: '2.0.0',
        fields: [{ name: 'id', type: 'number', required: true }],
      };

      service.registerSchema('test.event', v1);
      service.registerSchema('test.event', v2);

      const isCompatible = service.isCompatible('test.event', '1.0.0', '2.0.0');
      expect(isCompatible).toBe(false);
    });

    it('should not allow required field to become optional', () => {
      const v1: EventSchema = {
        name: 'Test',
        version: '1.0.0',
        fields: [{ name: 'id', type: 'string', required: true }],
      };

      const v2: EventSchema = {
        name: 'Test',
        version: '2.0.0',
        fields: [{ name: 'id', type: 'string', required: false }],
      };

      service.registerSchema('test.event', v1);
      service.registerSchema('test.event', v2);

      const isCompatible = service.isCompatible('test.event', '1.0.0', '2.0.0');
      expect(isCompatible).toBe(false);
    });

    it('should allow adding optional fields', () => {
      const v1: EventSchema = {
        name: 'Test',
        version: '1.0.0',
        fields: [{ name: 'id', type: 'string', required: true }],
      };

      const v2: EventSchema = {
        name: 'Test',
        version: '2.0.0',
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'optionalField', type: 'string', required: false },
        ],
      };

      service.registerSchema('test.event', v1);
      service.registerSchema('test.event', v2);

      const isCompatible = service.isCompatible('test.event', '1.0.0', '2.0.0');
      expect(isCompatible).toBe(true);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple event types independently', () => {
      const userSchema: EventSchema = {
        name: 'User',
        version: '1.0.0',
        fields: [{ name: 'userId', type: 'string', required: true }],
      };

      const postSchema: EventSchema = {
        name: 'Post',
        version: '1.0.0',
        fields: [{ name: 'postId', type: 'string', required: true }],
      };

      service.registerSchema('user.created', userSchema);
      service.registerSchema('post.created', postSchema);

      expect(service.getRegisteredEventTypes()).toHaveLength(2);

      const userErrors = service.validateEvent('user.created', {
        userId: 'user-1',
      });
      const postErrors = service.validateEvent('post.created', {
        postId: 'post-1',
      });

      expect(userErrors).toHaveLength(0);
      expect(postErrors).toHaveLength(0);
    });

    it('should maintain separate compatibility matrices for different event types', () => {
      const userV1: EventSchema = {
        name: 'User',
        version: '1.0.0',
        fields: [{ name: 'id', type: 'string', required: true }],
      };

      const userV2: EventSchema = {
        name: 'User',
        version: '2.0.0',
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'name', type: 'string', required: false },
        ],
      };

      service.registerSchema('user.event', userV1);
      service.registerSchema('user.event', userV2);

      expect(service.isCompatible('user.event', '1.0.0', '2.0.0')).toBe(true);
      expect(service.isCompatible('user.event', '2.0.0', '1.0.0')).toBe(false);
    });
  });
});
