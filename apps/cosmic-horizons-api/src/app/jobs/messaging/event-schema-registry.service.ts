import { Injectable, Logger, BadRequestException } from '@nestjs/common';

/**
 * Event Schema Registry & Validation Service
 *
 * Manages event schemas with:
 * - Version management and semantic versioning
 * - Schema validation and conformance checking
 * - Backward compatibility verification
 * - Schema evolution and migration support
 */

export interface EventSchema {
  name: string;
  version: string;
  description?: string;
  fields: SchemaField[];
  deprecatedFields?: string[];
}

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required: boolean;
  description?: string;
  enum?: string[] | number[];
  default?: unknown;
}

export interface ValidationError {
  field: string;
  error: string;
}

export interface SchemaRegistration {
  eventType: string;
  versions: Map<string, EventSchema>;
  compatibilityMatrix: Map<string, Map<string, boolean>>;
}

@Injectable()
export class EventSchemaRegistry {
  private readonly logger = new Logger('EventSchemaRegistry');
  private registrations: Map<string, SchemaRegistration> = new Map();

  /**
   * Register an event schema with version tracking
   */
  registerSchema(eventType: string, schema: EventSchema): void {
    try {
      if (!eventType || !schema) {
        throw new BadRequestException('eventType and schema are required');
      }

      if (!this.isValidSemanticVersion(schema.version)) {
        throw new BadRequestException(
          `Invalid semantic version: ${schema.version}. Expected format: major.minor.patch`,
        );
      }

      let registration = this.registrations.get(eventType);
      if (!registration) {
        registration = {
          eventType,
          versions: new Map(),
          compatibilityMatrix: new Map(),
        };
        this.registrations.set(eventType, registration);
      }

      // Check if version already exists
      if (registration.versions.has(schema.version)) {
        throw new BadRequestException(
          `Schema version ${schema.version} already registered for ${eventType}`,
        );
      }

      registration.versions.set(schema.version, schema);
      this.logger.log(`Registered schema: ${eventType}@${schema.version}`);

      // Build compatibility matrix
      this.updateCompatibilityMatrix(registration);
    } catch (error) {
      this.logger.error(
        `Failed to register schema: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Retrieve schema by event type and optional version
   */
  getSchema(eventType: string, version?: string): EventSchema {
    const registration = this.registrations.get(eventType);
    if (!registration) {
      throw new BadRequestException(
        `No schemas registered for event type: ${eventType}`,
      );
    }

    if (version) {
      const schema = registration.versions.get(version);
      if (!schema) {
        throw new BadRequestException(
          `Schema version ${version} not found for ${eventType}`,
        );
      }
      return schema;
    }

    // Return latest version
    const versions = Array.from(registration.versions.keys()).sort(
      this.compareVersions,
    );
    const latestVersion = versions[versions.length - 1];
    if (!latestVersion) {
      throw new BadRequestException(
        `No schema versions registered for event type: ${eventType}`,
      );
    }

    const latestSchema = registration.versions.get(latestVersion);
    if (!latestSchema) {
      throw new BadRequestException(
        `Schema version ${latestVersion} not found for ${eventType}`,
      );
    }

    return latestSchema;
  }

  /**
   * Validate event against schema
   */
  validateEvent(
    eventType: string,
    event: Record<string, unknown>,
    version?: string,
  ): ValidationError[] {
    try {
      const schema = this.getSchema(eventType, version);
      const errors: ValidationError[] = [];

      for (const field of schema.fields) {
        const value = event[field.name];

        // Check required fields
        if (field.required && (value === undefined || value === null)) {
          errors.push({
            field: field.name,
            error: `Required field missing`,
          });
          continue;
        }

        // Skip validation for optional missing fields
        if (!field.required && (value === undefined || value === null)) {
          continue;
        }

        // Type validation
        if (!this.validateFieldType(value, field.type)) {
          errors.push({
            field: field.name,
            error: `Invalid type. Expected ${field.type}, got ${typeof value}`,
          });
          continue;
        }

        // Enum validation
        if (
          field.enum &&
          Array.isArray(field.enum) &&
          !field.enum.includes(value as never)
        ) {
          errors.push({
            field: field.name,
            error: `Value must be one of: ${field.enum.join(', ')}`,
          });
        }
      }

      if (errors.length > 0) {
        this.logger.warn(
          `Validation failed for ${eventType}: ${errors.map((e) => e.error).join(', ')}`,
        );
      }

      return errors;
    } catch (error) {
      this.logger.error(
        `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Check backward compatibility between versions
   */
  isCompatible(
    eventType: string,
    oldVersion: string,
    newVersion: string,
  ): boolean {
    try {
      const registration = this.registrations.get(eventType);
      if (!registration) {
        throw new BadRequestException(
          `No schemas registered for event type: ${eventType}`,
        );
      }

      const compatibility = registration.compatibilityMatrix.get(oldVersion);
      if (!compatibility) {
        return false;
      }

      return compatibility.get(newVersion) ?? false;
    } catch (error) {
      this.logger.error(
        `Compatibility check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  /**
   * Get all schema versions for event type
   */
  getSchemaVersions(eventType: string): string[] {
    const registration = this.registrations.get(eventType);
    if (!registration) {
      throw new BadRequestException(
        `No schemas registered for event type: ${eventType}`,
      );
    }

    return Array.from(registration.versions.keys()).sort(this.compareVersions);
  }

  /**
   * Get all registered event types
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.registrations.keys());
  }

  /**
   * Clear all schemas (useful for testing)
   */
  clear(): void {
    this.registrations.clear();
    this.logger.warn('All schemas cleared');
  }

  /**
   * Internal: Update compatibility matrix
   */
  private updateCompatibilityMatrix(registration: SchemaRegistration): void {
    const versions = Array.from(registration.versions.keys());

    for (const version1 of versions) {
      if (!registration.compatibilityMatrix.has(version1)) {
        registration.compatibilityMatrix.set(version1, new Map());
      }

      const schema1 = registration.versions.get(version1);
      if (!schema1) {
        continue;
      }

      for (const version2 of versions) {
        // Same version is always compatible
        if (version1 === version2) {
          const sameVersionMap = registration.compatibilityMatrix.get(version1);
          if (sameVersionMap) {
            sameVersionMap.set(version2, true);
          }
          continue;
        }

        const schema2 = registration.versions.get(version2);
        if (!schema2) {
          continue;
        }

        // Check if version2 is a forward-compatible upgrade from version1
        const isForwardCompatible = this.checkForwardCompatibility(
          schema1,
          schema2,
        );
        const compatibilityMap = registration.compatibilityMatrix.get(version1);
        if (compatibilityMap) {
          compatibilityMap.set(version2, isForwardCompatible);
        }
      }
    }
  }

  /**
   * Internal: Check if newSchema is forward compatible with oldSchema
   */
  private checkForwardCompatibility(
    oldSchema: EventSchema,
    newSchema: EventSchema,
  ): boolean {
    const oldFields = new Map(oldSchema.fields.map((f) => [f.name, f]));
    const newFields = new Map(newSchema.fields.map((f) => [f.name, f]));

    // All required fields in oldSchema must exist in newSchema
    for (const [fieldName, oldField] of oldFields.entries()) {
      const newField = newFields.get(fieldName);
      if (!newField) {
        return false; // Required field was removed
      }

      // Type must remain compatible
      if (oldField.type !== newField.type) {
        return false;
      }

      // Required fields in old schema must still be required in new schema
      if (oldField.required && !newField.required) {
        return false;
      }
    }

    // New fields must have defaults if they're required
    for (const [fieldName, newField] of newFields.entries()) {
      if (
        !oldFields.has(fieldName) &&
        newField.required &&
        newField.default === undefined
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Internal: Validate field type
   */
  private validateFieldType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return (
          value instanceof Date ||
          (typeof value === 'string' && !isNaN(Date.parse(value)))
        );
      case 'object':
        return (
          typeof value === 'object' && value !== null && !Array.isArray(value)
        );
      case 'array':
        return Array.isArray(value);
      default:
        return false;
    }
  }

  /**
   * Internal: Check if version is valid semantic version
   */
  private isValidSemanticVersion(version: string): boolean {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    return semverRegex.test(version);
  }

  /**
   * Internal: Compare semantic versions
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (parts1[i] !== parts2[i]) {
        return (parts1[i] ?? 0) - (parts2[i] ?? 0);
      }
    }
    return 0;
  }
}
