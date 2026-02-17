import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommentReportRepository } from './comment-report.repository';
import { CommentReport } from '../entities/comment-report.entity';
import { CommentReportBuilder } from '../testing/test-builders';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('CommentReportRepository', () => {
  let repository: CommentReportRepository;
  let mockRepository: jest.Mocked<Repository<CommentReport>>;

  const createMockCommentReportRepository = () =>
    ({
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    }) as unknown as jest.Mocked<Repository<CommentReport>>;

  beforeEach(async () => {
    mockRepository = createMockCommentReportRepository();

    testingModule = await Test.createTestingModule({
      providers: [
        CommentReportRepository,
        {
          provide: getRepositoryToken(CommentReport),
          useValue: mockRepository,
        },
      ],
    }).compile();

    repository = testingModule.get<CommentReportRepository>(
      CommentReportRepository,
    );
  });

  describe('create', () => {
    it('should create report successfully', async () => {
      const reportData = new CommentReportBuilder()
        .withReason('Spam')
        .withComment({ id: 'comment-1' } as any)
        .withUser({ id: 'user-1' } as any)
        .build();

      const expectedResult = { id: 'report-1', ...reportData };

      mockRepository.create.mockReturnValue(reportData as any);
      mockRepository.save.mockResolvedValue(expectedResult as any);

      const result = await repository.create(reportData);

      expect(mockRepository.create).toHaveBeenCalledWith(reportData);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.reason).toBe('Spam');
    });

    it('should save created report', async () => {
      const reportData: Partial<CommentReport> = {
        reason: 'Offensive content',
        comment: { id: 'comment-1' } as any,
        user: { id: 'user-1' } as any,
      };

      const createdReport = new CommentReportBuilder()
        .withId('report-1')
        .withReason('Offensive content')
        .build();

      mockRepository.create.mockReturnValue(reportData as any);
      mockRepository.save.mockResolvedValue(createdReport as any);

      await repository.create(reportData);

      expect(mockRepository.save).toHaveBeenCalledWith(reportData);
    });
  });

  describe('findAll', () => {
    it('should find all reports with correct relations', async () => {
      const reports = [
        new CommentReportBuilder().withId('report-1').build(),
        new CommentReportBuilder().withId('report-2').build(),
      ];

      mockRepository.find.mockResolvedValue(reports as any);

      const result = await repository.findAll();

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['comment', 'user', 'resolver'],
          order: { created_at: 'DESC' },
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('should return empty array if no reports exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should include resolver in relations for resolved reports', async () => {
      const reports = [
        new CommentReportBuilder().withStatus('reviewed').build(),
      ];

      mockRepository.find.mockResolvedValue(reports as any);

      await repository.findAll();

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: expect.arrayContaining(['resolver']),
        }),
      );
    });
  });

  describe('findPending', () => {
    it('should find all pending reports', async () => {
      const pendingReports = [
        new CommentReportBuilder().withStatus('pending').build(),
        new CommentReportBuilder().withStatus('pending').build(),
      ];

      mockRepository.find.mockResolvedValue(pendingReports as any);

      const result = await repository.findPending();

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('should filter by pending status', async () => {
      mockRepository.find.mockResolvedValue([]);

      await repository.findPending();

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });

    it('should order by created_at ascending', async () => {
      mockRepository.find.mockResolvedValue([]);

      await repository.findPending();

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { created_at: 'ASC' },
        }),
      );
    });
  });

  describe('findById', () => {
    it('should find report by id', async () => {
      const report = new CommentReportBuilder().withId('report-1').build();

      mockRepository.findOne.mockResolvedValue(report as any);

      const result = await repository.findById('report-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'report-1' },
        }),
      );
      expect(result?.id).toBe('report-1');
    });

    it('should return null if report not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should include all relations when fetching by id', async () => {
      const report = new CommentReportBuilder().build();

      mockRepository.findOne.mockResolvedValue(report as any);

      await repository.findById('report-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['comment', 'user', 'resolver'],
        }),
      );
    });
  });

  describe('resolve', () => {
    it('should resolve report with reviewed status', async () => {
      const reportId = 'report-1';
      const resolverId = 'admin-1';
      const status = 'reviewed' as const;

      const resolvedReport = new CommentReportBuilder()
        .withId(reportId)
        .withStatus(status)
        .build();

      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOne.mockResolvedValue(resolvedReport as any);

      const result = await repository.resolve(reportId, resolverId, status);

      expect(mockRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: reportId }),
        expect.objectContaining({
          status: 'reviewed',
          resolved_by: resolverId,
        }),
      );
      expect(result?.status).toBe('reviewed');
    });

    it('should resolve report with dismissed status', async () => {
      const reportId = 'report-1';
      const resolverId = 'admin-1';
      const status = 'dismissed' as const;

      const resolvedReport = new CommentReportBuilder()
        .withId(reportId)
        .withStatus(status)
        .build();

      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOne.mockResolvedValue(resolvedReport as any);

      const result = await repository.resolve(reportId, resolverId, status);

      expect(mockRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: reportId }),
        expect.objectContaining({
          status: 'dismissed',
          resolved_by: resolverId,
        }),
      );
      expect(result?.status).toBe('dismissed');
    });

    it('should set resolved_at timestamp and resolved_by user', async () => {
      const reportId = 'report-1';
      const resolverId = 'admin-1';

      const resolvedReport = new CommentReportBuilder().build();
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOne.mockResolvedValue(resolvedReport as any);

      await repository.resolve(reportId, resolverId, 'reviewed');

      expect(mockRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: reportId }),
        expect.objectContaining({
          resolved_by: resolverId,
        }),
      );
    });

    it('should return updated report after resolving', async () => {
      const reportId = 'report-1';
      const resolvedReport = new CommentReportBuilder()
        .withId(reportId)
        .withStatus('reviewed')
        .build();

      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOne.mockResolvedValue(resolvedReport as any);

      const result = await repository.resolve(reportId, 'admin-1', 'reviewed');

      expect(result?.id).toBe(reportId);
      expect(result?.status).toBe('reviewed');
    });

    it('should return null if report not found after update', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.resolve(
        'nonexistent',
        'admin-1',
        'reviewed',
      );

      expect(result).toBeNull();
    });
  });
});
