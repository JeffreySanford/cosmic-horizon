import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditEntityType, AuditLog } from '../entities';

export interface CreateAuditLogParams {
  user_id?: string | null;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  changes?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

@Injectable()
export class AuditLogRepository {
  private readonly logger = new Logger(AuditLogRepository.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async createAuditLog(params: CreateAuditLogParams): Promise<void> {
    try {
      const auditLog = this.repo.create({
        user_id: params.user_id ?? null,
        action: params.action,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        changes: params.changes ?? null,
        ip_address: params.ip_address ?? null,
        user_agent: params.user_agent ?? null,
      });
      await this.repo.save(auditLog);
    } catch (error) {
      this.logger.warn(
        `Failed to write audit log for ${params.entity_type}:${params.entity_id} (${params.action})`,
        error instanceof Error ? error.message : 'unknown error',
      );
    }
  }
}
