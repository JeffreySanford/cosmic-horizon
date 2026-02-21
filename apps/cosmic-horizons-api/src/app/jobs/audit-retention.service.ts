import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);
  private readonly retentionDays: number;

  constructor(
    private readonly auditRepo: AuditLogRepository,
    private readonly config: ConfigService,
  ) {
    this.retentionDays = Number(this.config.get('AUDIT_RETENTION_DAYS', 90));
  }

  /**
   * Purge audit log records older than `AUDIT_RETENTION_DAYS` once a day.
   * Scheduling at 01:00 UTC to avoid overlapping other nightly jobs.
   */
  @Cron('0 1 * * *') async handleDailyRetention() {
    this.logger.log(
      `Running audit retention job (deleting logs older than ${this.retentionDays} days)`,
    );
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);
    const iso = cutoff.toISOString();

    try {
      // bypass repository abstraction for bulk delete
      await this.auditRepo['repo'].query(
        `DELETE FROM "audit_logs" WHERE "created_at" < $1`,
        [iso],
      );
      this.logger.log('Audit retention purge completed');
    } catch (error) {
      this.logger.error(
        'Audit retention job failed',
        error instanceof Error ? error.message : 'unknown',
      );
    }
  }
}
