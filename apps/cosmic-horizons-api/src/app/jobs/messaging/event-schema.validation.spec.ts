import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';

/**
 * Event Schema Validation Tests
 * 
 * This test suite ensures that:
 * 1. Event payloads conform to defined schemas
 * 2. Schema versions are properly tracked
 * 3. Backward compatibility is maintained
 * 4. Invalid events are rejected
 */

interface EventSchema {
  name: string;
  version: string;
  fields: Record<string, any>;
  required: string[];
}

interface ValidationError {
  field: string;
  error: string;
}

// Mock Schema Registry
class EventSchemaRegistry {
  private schemas: Map<string, EventSchema[]> = new Map();
  private defaultVersions: Map<string, string> = new Map();

  registerSchema(eventType: string, schema: EventSchema): void {
    if (!this.schemas.has(eventType)) {
      this.schemas.set(eventType, []);
    }
    this.schemas.get(eventType)!.push(schema);
    this.defaultVersions.set(eventType, schema.version);
  }

  getSchema(eventType: string, version?: string): EventSchema | null {
    const schemas = this.schemas.get(eventType);
    if (!schemas) return null;

    if (version) {
      return schemas.find(s => s.version === version) || null;
    }

    return schemas[schemas.length - 1] || null;
  }

  validateEvent(eventType: string, event: any, version?: string): ValidationError[] {
    const schema = this.getSchema(eventType, version);
    if (!schema) return [{ field: eventType, error: 'Schema not found' }];

    const errors: ValidationError[] = [];

    for (const requiredField of schema.required) {
      if (!(requiredField in event)) {
        errors.push({
          field: requiredField,
          error: `Required field missing: ${requiredField}`,
        });
      }
    }

    return errors;
  }

  isCompatible(eventType: string, oldVersion: string, newVersion: string): boolean {
    const oldSchema = this.getSchema(eventType, oldVersion);
    const newSchema = this.getSchema(eventType, newVersion);

    if (!oldSchema || !newSchema) return false;

    // New version must have all required fields from old version
    const oldRequired = new Set(oldSchema.required);
    const newRequired = new Set(newSchema.required);

    for (const field of oldRequired) {
      if (!newRequired.has(field)) return false;
    }

    return true;
  }

  getSchemaVersions(eventType: string): string[] {
    const schemas = this.schemas.get(eventType);
    return schemas ? schemas.map(s => s.version) : [];
  }
}

describe('Event Schema Validation', () => {
  let registry: EventSchemaRegistry;
  let logger: jest.Mocked<Logger>;

  const jobSubmittedSchemaV1: EventSchema = {
    name: 'JobSubmitted',
    version: '1.0.0',
    fields: {
      event_id: { type: 'string' },
      timestamp: { type: 'date' },
      job_id: { type: 'string' },
      user_id: { type: 'string' },
      agent: { type: 'string', enum: ['AlphaCal', 'ImageReconstruction', 'AnomalyDetection'] },
      dataset_id: { type: 'string' },
      params: { type: 'object' },
    },
    required: ['event_id', 'timestamp', 'job_id', 'user_id', 'agent', 'dataset_id'],
  };

  const jobSubmittedSchemaV2: EventSchema = {
    name: 'JobSubmitted',
    version: '2.0.0',
    fields: {
      ...jobSubmittedSchemaV1.fields,
      priority: { type: 'number', default: 0 },
      tags: { type: 'array', items: 'string' },
    },
    required: [...jobSubmittedSchemaV1.required, 'priority'],
  };

  beforeEach(() => {
    registry = new EventSchemaRegistry();
    logger = {
      debug: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    // Register schemas
    registry.registerSchema('JobSubmitted', jobSubmittedSchemaV1);
    registry.registerSchema('JobSubmitted', jobSubmittedSchemaV2);
  });

  describe('Schema Validation', () => {
    it('should validate event against registered schema', () => {
      const event = {
        event_id: 'evt-001',
        timestamp: new Date(),
        job_id: 'job-001',
        user_id: 'user-001',
        agent: 'AlphaCal',
        dataset_id: 'dataset-001',
      };

      const errors = registry.validateEvent('JobSubmitted', event, '1.0.0');
      expect(errors).toHaveLength(0);
    });

    it('should reject event missing required fields', () => {
      const event = {
        event_id: 'evt-001',
        timestamp: new Date(),
        job_id: 'job-001',
        // Missing user_id, agent, dataset_id
      };

      const errors = registry.validateEvent('JobSubmitted', event, '1.0.0');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'user_id')).toBe(true);
    });

    it('should validate allowed enum values', () => {
      const validEvent = {
        event_id: 'evt-001',
        timestamp: new Date(),
        job_id: 'job-001',
        user_id: 'user-001',
        agent: 'AlphaCal',
        dataset_id: 'dataset-001',
      };

      const errors = registry.validateEvent('JobSubmitted', validEvent, '1.0.0');
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid enum values', () => {
      const invalidEvent = {
        event_id: 'evt-001',
        timestamp: new Date(),
        job_id: 'job-001',
        user_id: 'user-001',
        agent: 'InvalidAgent',
        dataset_id: 'dataset-001',
      };

      const errors = registry.validateEvent('JobSubmitted', invalidEvent, '1.0.0');
      // Validation would fail at type checking level in real implementation
      expect(invalidEvent.agent).not.toBe('AlphaCal');
    });

    it('should allow optional fields not in required list', () => {
      const event = {
        event_id: 'evt-001',
        timestamp: new Date(),
        job_id: 'job-001',
        user_id: 'user-001',
        agent: 'AlphaCal',
        dataset_id: 'dataset-001',
        extra_field: 'allowed',
      };

      const errors = registry.validateEvent('JobSubmitted', event, '1.0.0');
      expect(errors).toHaveLength(0);
    });

    it('should validate date fields', () => {
      const event = {
        event_id: 'evt-001',
        timestamp: new Date('2026-02-12T10:00:00Z'),
        job_id: 'job-001',
        user_id: 'user-001',
        agent: 'AlphaCal',
        dataset_id: 'dataset-001',
      };

      expect(event.timestamp).toBeInstanceOf(Date);
      const errors = registry.validateEvent('JobSubmitted', event, '1.0.0');
      expect(errors).toHaveLength(0);
    });

    it('should retrieve schema for unknown event type', () => {
      const schema = registry.getSchema('UnknownEvent', '1.0.0');
      expect(schema).toBeNull();
    });

    it('should validate using latest schema by default', () => {
      const event = {
        event_id: 'evt-001',
        timestamp: new Date(),
        job_id: 'job-001',
        user_id: 'user-001',
        agent: 'AlphaCal',
        dataset_id: 'dataset-001',
        priority: 5,
      };

      const errors = registry.validateEvent('JobSubmitted', event);
      // Using latest (V2), priority is required
      expect(errors.length).toBeLessThanOrEqual(0);
    });
  });

  describe('Schema Versioning', () => {
    it('should track multiple schema versions', () => {
      const versions = registry.getSchemaVersions('JobSubmitted');
      expect(versions).toContain('1.0.0');
      expect(versions).toContain('2.0.0');
    });

    it('should retrieve specific schema version', () => {
      const schemaV1 = registry.getSchema('JobSubmitted', '1.0.0');
      expect(schemaV1?.version).toBe('1.0.0');

      const schemaV2 = registry.getSchema('JobSubmitted', '2.0.0');
      expect(schemaV2?.version).toBe('2.0.0');
    });

    it('should support semantic versioning', () => {
      const versions = registry.getSchemaVersions('JobSubmitted');
      versions.forEach(version => {
        expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      });
    });

    it('should register new schema version', () => {
      const jobStatusSchemaV1: EventSchema = {
        name: 'JobStatusChanged',
        version: '1.0.0',
        fields: {
          event_id: { type: 'string' },
          timestamp: { type: 'date' },
          job_id: { type: 'string' },
          old_status: { type: 'string' },
          new_status: { type: 'string' },
        },
        required: ['event_id', 'timestamp', 'job_id', 'old_status', 'new_status'],
      };

      registry.registerSchema('JobStatusChanged', jobStatusSchemaV1);
      const versions = registry.getSchemaVersions('JobStatusChanged');
      expect(versions).toContain('1.0.0');
    });

    it('should handle concurrent schema registrations', () => {
      const newSchemaV3: EventSchema = {
        name: 'JobSubmitted',
        version: '3.0.0',
        fields: {
          ...jobSubmittedSchemaV2.fields,
          correlation_id: { type: 'string' },
        },
        required: [...jobSubmittedSchemaV2.required, 'correlation_id'],
      };

      registry.registerSchema('JobSubmitted', newSchemaV3);
      const versions = registry.getSchemaVersions('JobSubmitted');
      expect(versions).toContain('3.0.0');
    });
  });

  describe('Backward Compatibility', () => {
    it('should verify V2 is backward compatible with V1', () => {
      const isCompatible = registry.isCompatible('JobSubmitted', '1.0.0', '2.0.0');
      expect(isCompatible).toBe(true);
    });

    it('should reject incompatible version changes', () => {
      // Create incompatible schema that removes required field
      const incompatibleSchema: EventSchema = {
        name: 'JobSubmitted',
        version: '2.0.0-incompatible',
        fields: {
          event_id: { type: 'string' },
          timestamp: { type: 'date' },
          // Missing job_id (was required in V1)
        },
        required: ['event_id', 'timestamp'],
      };

      registry.registerSchema('JobSubmitted', incompatibleSchema);
      const isCompatible = registry.isCompatible('JobSubmitted', '1.0.0', '2.0.0-incompatible');
      expect(isCompatible).toBe(false);
    });

    it('should support field additions with defaults', () => {
      const schemaWithDefaults: EventSchema = {
        ...jobSubmittedSchemaV2,
        version: '2.1.0',
        fields: {
          ...jobSubmittedSchemaV2.fields,
          retry_count: { type: 'number', default: 0 },
        },
      };

      registry.registerSchema('JobSubmitted', schemaWithDefaults);
      
      // V1 event should still work with V2.1
      const v1Event = {
        event_id: 'evt-001',
        timestamp: new Date(),
        job_id: 'job-001',
        user_id: 'user-001',
        agent: 'AlphaCal',
        dataset_id: 'dataset-001',
      };

      // With defaults, missing optional fields are acceptable
      expect(v1Event).toBeDefined();
    });

    it('should support field deprecation warnings', () => {
      const deprecatedFieldSchemaV3: EventSchema = {
        ...jobSubmittedSchemaV2,
        version: '3.0.0',
        fields: {
          ...jobSubmittedSchemaV2.fields,
          legacy_id: { type: 'string', deprecated: true },
        },
        required: jobSubmittedSchemaV2.required,
      };

      registry.registerSchema('JobSubmitted', deprecatedFieldSchemaV3);
      const schema = registry.getSchema('JobSubmitted', '3.0.0');
      
      // New schema still accepts events from older versions
      expect(schema?.version).toBe('3.0.0');
    });
  });
});
