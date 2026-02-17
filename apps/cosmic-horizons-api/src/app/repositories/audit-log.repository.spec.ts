import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogRepository } from './audit-log.repository';
import {
  AuditLog,
  AuditAction,
  AuditEntityType,
} from '../entities/audit-log.entity';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('AuditLogRepository', () => {
  let repository: AuditLogRepository;
  let mockRepository: jest.Mocked<Repository<AuditLog>>;

  const createMockAuditLogRepository = () =>
    ({
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    }) as unknown as jest.Mocked<Repository<AuditLog>>;

  beforeEach(async () => {
    mockRepository = createMockAuditLogRepository();

    testingModule = await Test.createTestingModule({
      providers: [
        AuditLogRepository,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepository,
        },
      ],
    }).compile();

    repository = testingModule.get<AuditLogRepository>(AuditLogRepository);
  });

  describe('createAuditLog - Fire-and-Forget Pattern', () => {
    it('should create and save audit log without returning data', async () => {
      const logData = {
        action: AuditAction.COMMENT,
        entity_type: AuditEntityType.COMMENT,
        entity_id: 'comment-1',
        user_id: 'user-1',
        changes: { content: 'New comment' },
        ip_address: '127.0.0.1',
      };

      mockRepository.create.mockReturnValue(logData as any);
      mockRepository.save.mockResolvedValue({} as any);

      const result = await repository.createAuditLog(logData);

      // Void return - no result data
      expect(result).toBeUndefined();
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should call create with log data', async () => {
      const logData = {
        action: AuditAction.UPDATE,
        entity_type: AuditEntityType.COMMENT,
        entity_id: 'comment-1',
        user_id: 'user-1',
        changes: {},
        ip_address: '127.0.0.1',
      };

      mockRepository.create.mockReturnValue(logData as any);
      mockRepository.save.mockResolvedValue({} as any);

      await repository.createAuditLog(logData);

      expect(mockRepository.create).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should call save after create', async () => {
      const logData = {
        action: AuditAction.PUBLISH,
        entity_type: AuditEntityType.POST,
        entity_id: 'post-1',
        user_id: 'user-1',
        changes: { status: 'PUBLISHED' },
        ip_address: '127.0.0.1',
      };

      mockRepository.create.mockReturnValue(logData as any);
      mockRepository.save.mockResolvedValue({} as any);

      await repository.createAuditLog(logData);

      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle logs with null user_id', async () => {
      const logData = {
        action: AuditAction.PUBLISH,
        entity_type: AuditEntityType.POST,
        entity_id: 'post-1',
        user_id: null,
        changes: { status: 'PUBLISHED' },
        ip_address: '127.0.0.1',
      };

      mockRepository.create.mockReturnValue(logData as any);
      mockRepository.save.mockResolvedValue({} as any);

      await repository.createAuditLog(logData);

      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should handle logs with null ip_address', async () => {
      const logData = {
        action: AuditAction.DELETE,
        entity_type: AuditEntityType.COMMENT,
        entity_id: 'comment-1',
        user_id: 'user-1',
        changes: { deleted_at: new Date() },
        ip_address: null,
      };

      mockRepository.create.mockReturnValue(logData as any);
      mockRepository.save.mockResolvedValue({} as any);

      await repository.createAuditLog(logData);

      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should suppress errors and not throw', async () => {
      const logData = {
        action: AuditAction.CREATE,
        entity_type: AuditEntityType.POST,
        entity_id: 'test-1',
        user_id: 'user-1',
        changes: {},
      };

      mockRepository.create.mockReturnValue(logData as any);
      mockRepository.save.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Should not throw even though save fails (fire-and-forget)
      await expect(repository.createAuditLog(logData)).resolves.toBeUndefined();
    });

    it('should handle save errors gracefully', async () => {
      const logData = {
        action: AuditAction.UPDATE,
        entity_type: AuditEntityType.POST,
        entity_id: 'test-1',
        user_id: 'user-1',
        changes: {},
      };

      const error = new Error('Save failed');
      mockRepository.create.mockReturnValue(logData as any);
      mockRepository.save.mockRejectedValue(error);

      // Should not throw
      await expect(repository.createAuditLog(logData)).resolves.toBeUndefined();
    });

    it('should handle empty changes object', async () => {
      const logData = {
        action: AuditAction.COMMENT,
        entity_type: AuditEntityType.COMMENT,
        entity_id: 'comment-1',
        user_id: 'user-1',
        changes: {},
        ip_address: '127.0.0.1',
      };

      mockRepository.create.mockReturnValue(logData as any);
      mockRepository.save.mockResolvedValue({} as any);

      await repository.createAuditLog(logData);

      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle complex nested changes', async () => {
      const logData = {
        action: AuditAction.UPDATE,
        entity_type: AuditEntityType.POST,
        entity_id: 'post-1',
        user_id: 'user-1',
        changes: {
          title: { old: 'Old Title', new: 'New Title' },
          content: { old: 'Old content', new: 'New content' },
        },
        ip_address: '192.168.1.1',
      };

      mockRepository.create.mockReturnValue(logData as any);
      mockRepository.save.mockResolvedValue({} as any);

      await repository.createAuditLog(logData);

      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should support multiple audit actions', async () => {
      mockRepository.create.mockImplementation((data) => data as AuditLog);
      mockRepository.save.mockResolvedValue({} as any);

      const actionList = [
        AuditAction.COMMENT,
        AuditAction.UPDATE,
        AuditAction.DELETE,
        AuditAction.PUBLISH,
        AuditAction.CREATE,
      ];

      for (const action of actionList) {
        const logData = {
          action,
          entity_type: AuditEntityType.POST,
          entity_id: 'test-1',
          user_id: 'user-1',
          changes: {},
        };

        await repository.createAuditLog(logData);
      }

      expect(mockRepository.save).toHaveBeenCalledTimes(5);
    });

    it('should be fire-and-forget (non-blocking)', async () => {
      const logData = {
        action: AuditAction.CREATE,
        entity_type: AuditEntityType.POST,
        entity_id: 'test-1',
        user_id: 'user-1',
        changes: {},
      };

      mockRepository.create.mockReturnValue(logData as any);
      mockRepository.save.mockImplementation(
        (entity: any) =>
          new Promise((resolve) => {
            setTimeout(() => resolve(entity), 100);
          }),
      );

      await repository.createAuditLog(logData);

      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle error during create without throwing', async () => {
      const logData = {
        action: AuditAction.CREATE,
        entity_type: AuditEntityType.POST,
        entity_id: 'test-1',
        user_id: 'user-1',
        changes: {},
      };

      mockRepository.create.mockImplementation(() => {
        throw new Error('Create failed');
      });

      // Should not throw (fire-and-forget)
      await expect(repository.createAuditLog(logData)).resolves.toBeUndefined();
    });
  });

  describe('Error Resilience', () => {
    it('should not interrupt application flow when audit log fails', async () => {
      const logData = {
        action: AuditAction.CREATE,
        entity_type: AuditEntityType.POST,
        entity_id: 'payment-1',
        user_id: 'user-1',
        changes: { amount: 100 },
      };

      mockRepository.create.mockReturnValue(logData as any);
      mockRepository.save.mockRejectedValue(new Error('Database timeout'));

      // Application should continue normally even if logging fails
      await expect(repository.createAuditLog(logData)).resolves.toBeUndefined();
    });

    it('should not accumulate errors in high-volume scenarios', async () => {
      const logDataArray = Array.from({ length: 10 }, (_, i) => ({
        action: `ACTION_${i}`,
        entity_type: 'Test',
        entity_id: `test-${i}`,
        user_id: 'user-1',
        changes: {},
      }));

      mockRepository.create.mockImplementation((data) => data as AuditLog);
      mockRepository.save.mockRejectedValue(new Error('Intermittent failure'));

      const promises = logDataArray.map((logData) =>
        repository.createAuditLog(logData as any),
      );

      // Should complete without throwing even with failures
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });
});
