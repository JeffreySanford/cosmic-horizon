import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaService } from '../../events/kafka.service';
import {
  ComplianceAuditorService,
  AuditEvent,
} from '../services/compliance-auditor.service';

/**
 * AuditTrailConsumer subscribes to audit trail events
 * Stores immutable audit records for compliance tracking
 */
@Injectable()
export class AuditTrailConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('AuditTrailConsumer');

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly complianceAuditorService: ComplianceAuditorService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafkaService.subscribe(
      'audit-consumer-group',
      ['audit-trail'],
      this.handleAuditEvent.bind(this),
    );
    this.logger.log(
      'AuditTrailConsumer initialized and subscribed to audit-trail',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.kafkaService.disconnect();
    this.logger.log('AuditTrailConsumer disconnected');
  }

  /**
   * Handle incoming audit trail event
   */
  private async handleAuditEvent(payload: EachMessagePayload): Promise<void> {
    try {
      const auditEvent = JSON.parse(
        payload.message.value?.toString() || '{}',
      ) as AuditEvent;

      this.logger.debug(
        `Received audit event: ${auditEvent.event_type} for job ${auditEvent.job_id}`,
      );

      // Store immutable audit record
      await this.complianceAuditorService.storeImmutableEvent(auditEvent);

      // Verify retention policy
      const isCompliant =
        await this.complianceAuditorService.verifyRetentionPolicy();

      if (!isCompliant) {
        this.logger.warn(
          'Audit trail is not in compliance with retention policy',
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to process audit event: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Non-blocking error handling - continue consuming
    }
  }
}
