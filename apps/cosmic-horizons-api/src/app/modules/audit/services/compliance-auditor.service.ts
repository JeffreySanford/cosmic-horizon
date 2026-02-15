import { Injectable, Logger } from '@nestjs/common';

export interface AuditEvent {
  event_id: string;
  job_id: string;
  user_id: string;
  event_type: string;
  timestamp: string;
  details: Record<string, unknown>;
  immutable_hash?: string;
}

/**
 * ComplianceAuditorService manages immutable audit trail storage
 * Ensures compliance with regulatory retention policies
 */
@Injectable()
export class ComplianceAuditorService {
  private readonly logger = new Logger('ComplianceAuditorService');

  // In-memory immutable audit trail (in production: database)
  private readonly auditTrail = new Map<string, AuditEvent>();

  // Retention policy: 90 days in milliseconds
  private readonly RETENTION_DAYS = 90;
  private readonly RETENTION_MS = this.RETENTION_DAYS * 24 * 60 * 60 * 1000;

  /**
   * Store immutable audit event
   */
  async storeImmutableEvent(event: AuditEvent): Promise<void> {
    try {
      // Generate immutable hash (in production: use cryptographic hash)
      const immutableHash = this.generateHash(event);

      const storedEvent = {
        ...event,
        immutable_hash: immutableHash,
      };

      this.auditTrail.set(event.event_id, storedEvent);

      this.logger.debug(
        `Stored immutable audit event ${event.event_id} for job ${event.job_id}`,
      );
    } catch (error) {
      this.logger.error(`Failed to store immutable event: ${error}`);
      throw error;
    }
  }

  /**
   * Query audit trail by job ID
   */
  async queryAuditTrail(jobId: string): Promise<AuditEvent[]> {
    try {
      const events = Array.from(this.auditTrail.values()).filter(
        (e) => e.job_id === jobId,
      );

      this.logger.debug(`Retrieved ${events.length} audit events for job ${jobId}`);
      return events;
    } catch (error) {
      this.logger.error(`Failed to query audit trail: ${error}`);
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(): Promise<{
    total_events: number;
    jobs_covered: number;
    oldest_event: string | null;
    retention_compliant: boolean;
  }> {
    try {
      const events = Array.from(this.auditTrail.values());
      const jobIds = new Set(events.map((e) => e.job_id));
      const oldestEvent =
        events.length > 0
          ? events.reduce((oldest, current) =>
              new Date(current.timestamp) < new Date(oldest.timestamp)
                ? current
                : oldest,
            )
          : null;

      const report = {
        total_events: events.length,
        jobs_covered: jobIds.size,
        oldest_event: oldestEvent?.timestamp || null,
        retention_compliant: this.isRetentionCompliant(),
      };

      this.logger.debug(
        `Generated compliance report: ${report.total_events} events`,
      );
      return report;
    } catch (error) {
      this.logger.error(`Failed to generate compliance report: ${error}`);
      throw error;
    }
  }

  /**
   * Verify retention policy compliance
   */
  async verifyRetentionPolicy(): Promise<boolean> {
    try {
      const events = Array.from(this.auditTrail.values());
      const now = new Date().getTime();

      const expiredEvents = events.filter((event) => {
        const eventTime = new Date(event.timestamp).getTime();
        return now - eventTime > this.RETENTION_MS;
      });

      if (expiredEvents.length > 0) {
        this.logger.warn(
          `Found ${expiredEvents.length} expired audit events, removing...`,
        );
        expiredEvents.forEach((event) => {
          this.auditTrail.delete(event.event_id);
        });
      }

      const isCompliant = this.isRetentionCompliant();
      this.logger.debug(
        `Retention policy check complete. Compliant: ${isCompliant}`,
      );

      return isCompliant;
    } catch (error) {
      this.logger.error(`Failed to verify retention policy: ${error}`);
      throw error;
    }
  }

  /**
   * Check if system is in compliance
   */
  private isRetentionCompliant(): boolean {
    const events = Array.from(this.auditTrail.values());
    if (events.length === 0) return true;

    const now = new Date().getTime();
    return events.every((event) => {
      const eventTime = new Date(event.timestamp).getTime();
      return now - eventTime <= this.RETENTION_MS;
    });
  }

  /**
   * Generate immutable hash for event
   */
  private generateHash(event: AuditEvent): string {
    const content = JSON.stringify({
      event_id: event.event_id,
      job_id: event.job_id,
      timestamp: event.timestamp,
      event_type: event.event_type,
    });
    // Simplified hash (in production: use SHA-256 or similar)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `hash_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Get all audit events (for testing)
   */
  getAllEvents(): AuditEvent[] {
    return Array.from(this.auditTrail.values());
  }

  /**
   * Clear audit trail (for testing)
   */
  clearAuditTrail(): void {
    this.auditTrail.clear();
  }
}
