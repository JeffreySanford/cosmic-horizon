import { Test, TestingModule } from '@nestjs/testing';
import { AuditRetentionService } from './audit-retention.service';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { ConfigService } from '@nestjs/config';

describe('AuditRetentionService', () => {
  let service: AuditRetentionService;
  let repo: jest.Mocked<AuditLogRepository>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    repo = {
      // we only need repo['repo'].query, so we create a fake object
      repo: { query: jest.fn().mockResolvedValue(undefined) } as any,
      createAuditLog: jest.fn(),
    } as any;
    config = { get: jest.fn().mockReturnValue('7') } as any; // retention 7 days

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditRetentionService,
        { provide: AuditLogRepository, useValue: repo },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<AuditRetentionService>(AuditRetentionService);
  });

  it('should delete logs older than configured days', async () => {
    await service.handleDailyRetention();
    expect(repo.repo.query).toHaveBeenCalled();
    const call = repo.repo.query.mock.calls[0][0] as string;
    expect(call).toContain('DELETE FROM "audit_logs"');
  });
});
