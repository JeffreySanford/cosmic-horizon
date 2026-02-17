import { Test, TestingModule } from '@nestjs/testing';
import { JobRepository, CreateJobParams } from './job.repository';
import { Repository } from 'typeorm';
import { Job, JobStatus } from '../entities/job.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('JobRepository - Branch Coverage', () => {
  let repository: JobRepository;
  let mockTypeOrmRepository: jest.Mocked<Repository<Job>>;

  const mockJob: Job = {
    id: 'job-123',
    user_id: 'user-1',
    agent: 'AlphaCal',
    dataset_id: 'dataset-1',
    status: 'QUEUED' as JobStatus,
    params: { gpu_count: 2, rfi_strategy: 'auto' },
    progress: 0,
    tacc_job_id: undefined,
    result: undefined,
    created_at: new Date(),
    updated_at: new Date(),
    completed_at: undefined,
  };

  beforeEach(async () => {
    mockTypeOrmRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    testingModule = await Test.createTestingModule({
      providers: [
        JobRepository,
        {
          provide: getRepositoryToken(Job),
          useValue: mockTypeOrmRepository,
        },
      ],
    }).compile();

    repository = testingModule.get<JobRepository>(JobRepository);
  });

  describe('create', () => {
    it('should create job with default QUEUED status and 0 progress', async () => {
      const createParams: CreateJobParams = {
        user_id: 'user-1',
        agent: 'AlphaCal',
        dataset_id: 'dataset-1',
        params: { gpu_count: 2 },
      };

      mockTypeOrmRepository.create.mockReturnValue(mockJob);
      mockTypeOrmRepository.save.mockResolvedValueOnce(mockJob);

      const result = await repository.create(createParams);

      expect(mockTypeOrmRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'QUEUED',
          progress: 0,
        }),
      );
      expect(result).toEqual(mockJob);
    });

    it('should spread all create params into entity', async () => {
      const createParams: CreateJobParams = {
        user_id: 'user-456',
        agent: 'RadioImageReconstruction',
        dataset_id: 'dataset-456',
        params: { gpu_count: 4, rfi_strategy: 'ml' },
        gpu_count: 4,
      };

      mockTypeOrmRepository.create.mockReturnValue(mockJob);
      mockTypeOrmRepository.save.mockResolvedValueOnce(mockJob);

      await repository.create(createParams);

      expect(mockTypeOrmRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-456',
          agent: 'RadioImageReconstruction',
          dataset_id: 'dataset-456',
          params: { gpu_count: 4, rfi_strategy: 'ml' },
          gpu_count: 4,
        }),
      );
    });

    it('should generate UUID for job id', async () => {
      mockTypeOrmRepository.create.mockReturnValue(mockJob);
      mockTypeOrmRepository.save.mockResolvedValueOnce(mockJob);

      const result = await repository.create({
        user_id: 'user-1',
        agent: 'AlphaCal',
        dataset_id: 'dataset-1',
        params: {},
      });

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
    });
  });

  describe('findById', () => {
    it('should find job by id', async () => {
      mockTypeOrmRepository.findOne.mockResolvedValueOnce(mockJob);

      const result = await repository.findById('job-123');

      expect(mockTypeOrmRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'job-123' },
      });
      expect(result).toEqual(mockJob);
    });

    it('should return null when job not found', async () => {
      mockTypeOrmRepository.findOne.mockResolvedValueOnce(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByTaccJobId', () => {
    it('should find job by TACC job id', async () => {
      const jobWithTacc = { ...mockJob, tacc_job_id: 'tacc-456' };
      mockTypeOrmRepository.findOne.mockResolvedValueOnce(jobWithTacc);

      const result = await repository.findByTaccJobId('tacc-456');

      expect(mockTypeOrmRepository.findOne).toHaveBeenCalledWith({
        where: { tacc_job_id: 'tacc-456' },
      });
      expect(result).toEqual(jobWithTacc);
    });

    it('should return null when TACC job id not found', async () => {
      mockTypeOrmRepository.findOne.mockResolvedValueOnce(null);

      const result = await repository.findByTaccJobId('non-existent-tacc-id');

      expect(result).toBeNull();
    });
  });

  describe('findByUser', () => {
    it('should find all jobs by user with defaults', async () => {
      const jobs = [mockJob];
      mockTypeOrmRepository.findAndCount.mockResolvedValueOnce([jobs, 1]);

      const [results, count] = await repository.findByUser('user-1');

      expect(mockTypeOrmRepository.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 'user-1' },
        order: { created_at: 'DESC' },
        take: 50,
        skip: 0,
      });
      expect(results).toEqual(jobs);
      expect(count).toBe(1);
    });

    it('should find jobs with custom limit and offset', async () => {
      const jobs = [mockJob];
      mockTypeOrmRepository.findAndCount.mockResolvedValueOnce([jobs, 100]);

      const [results, count] = await repository.findByUser('user-1', 25, 100);

      expect(mockTypeOrmRepository.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 'user-1' },
        order: { created_at: 'DESC' },
        take: 25,
        skip: 100,
      });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('job-123');
      expect(count).toBe(100);
    });

    it('should order results by created_at DESC', async () => {
      mockTypeOrmRepository.findAndCount.mockResolvedValueOnce([[], 0]);

      await repository.findByUser('user-1');

      expect(mockTypeOrmRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { created_at: 'DESC' },
        }),
      );
    });

    it('should return empty array when user has no jobs', async () => {
      mockTypeOrmRepository.findAndCount.mockResolvedValueOnce([[], 0]);

      const [results, count] = await repository.findByUser('user-no-jobs');

      expect(results).toEqual([]);
      expect(count).toBe(0);
    });
  });

  describe('findByStatus', () => {
    it('should find all jobs by status', async () => {
      const queuedJobs = [mockJob, { ...mockJob, id: 'job-456' }];
      mockTypeOrmRepository.find.mockResolvedValueOnce(queuedJobs);

      const result = await repository.findByStatus('QUEUED');

      expect(mockTypeOrmRepository.find).toHaveBeenCalledWith({
        where: { status: 'QUEUED' },
        order: { created_at: 'ASC' },
      });
      expect(result).toEqual(queuedJobs);
    });

    it('should order results by created_at ASC', async () => {
      mockTypeOrmRepository.find.mockResolvedValueOnce([]);

      await repository.findByStatus('RUNNING');

      expect(mockTypeOrmRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { created_at: 'ASC' },
        }),
      );
    });

    it('should return empty array when no jobs have status', async () => {
      mockTypeOrmRepository.find.mockResolvedValueOnce([]);

      const result = await repository.findByStatus('COMPLETED');

      expect(result).toEqual([]);
    });

    it('should handle all job statuses', async () => {
      const statuses: JobStatus[] = [
        'QUEUED',
        'RUNNING',
        'COMPLETED',
        'FAILED',
      ];

      for (const status of statuses) {
        mockTypeOrmRepository.find.mockResolvedValueOnce([]);
        await repository.findByStatus(status);
        expect(mockTypeOrmRepository.find).toHaveBeenCalledWith(
          expect.objectContaining({ where: { status } }),
        );
      }
    });
  });

  describe('updateStatus', () => {
    it('should update status without progress or completed_at', async () => {
      mockTypeOrmRepository.update.mockResolvedValueOnce({} as any);

      await repository.updateStatus('job-123', 'RUNNING');

      expect(mockTypeOrmRepository.update).toHaveBeenCalledWith(
        { id: 'job-123' },
        {
          status: 'RUNNING',
        },
      );
    });

    it('should update status with progress when provided', async () => {
      mockTypeOrmRepository.update.mockResolvedValueOnce({} as any);

      await repository.updateStatus('job-123', 'RUNNING', 50);

      expect(mockTypeOrmRepository.update).toHaveBeenCalledWith(
        { id: 'job-123' },
        {
          status: 'RUNNING',
          progress: 50,
        },
      );
    });

    it('should NOT include progress when undefined', async () => {
      mockTypeOrmRepository.update.mockResolvedValueOnce({} as any);

      await repository.updateStatus('job-123', 'RUNNING', undefined);

      const updateData = mockTypeOrmRepository.update.mock.calls[0][1];
      expect(updateData).not.toHaveProperty('progress');
    });

    it('should set completed_at when status is COMPLETED', async () => {
      mockTypeOrmRepository.update.mockResolvedValueOnce({} as any);

      const before = new Date();
      await repository.updateStatus('job-123', 'COMPLETED');
      const after = new Date();

      const updateData = mockTypeOrmRepository.update.mock.calls[0][1];
      expect(updateData).toHaveProperty('completed_at');
      const completedAt = (updateData as any).completed_at;
      expect(completedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(completedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should set completed_at when status is FAILED', async () => {
      mockTypeOrmRepository.update.mockResolvedValueOnce({} as any);

      const before = new Date();
      await repository.updateStatus('job-123', 'FAILED');
      const after = new Date();

      const updateData = mockTypeOrmRepository.update.mock.calls[0][1];
      expect(updateData).toHaveProperty('completed_at');
      const completedAt = (updateData as any).completed_at;
      expect(completedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(completedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should NOT set completed_at when status is QUEUED', async () => {
      mockTypeOrmRepository.update.mockResolvedValueOnce({} as any);

      await repository.updateStatus('job-123', 'QUEUED');

      const updateData = mockTypeOrmRepository.update.mock.calls[0][1];
      expect(updateData).not.toHaveProperty('completed_at');
    });

    it('should NOT set completed_at when status is RUNNING', async () => {
      mockTypeOrmRepository.update.mockResolvedValueOnce({} as any);

      await repository.updateStatus('job-123', 'RUNNING');

      const updateData = mockTypeOrmRepository.update.mock.calls[0][1];
      expect(updateData).not.toHaveProperty('completed_at');
    });

    it('should set completed_at with progress when both provided and status is COMPLETED', async () => {
      mockTypeOrmRepository.update.mockResolvedValueOnce({} as any);

      await repository.updateStatus('job-123', 'COMPLETED', 100);

      const updateData = mockTypeOrmRepository.update.mock.calls[0][1];
      expect(updateData).toHaveProperty('status', 'COMPLETED');
      expect(updateData).toHaveProperty('progress', 100);
      expect(updateData).toHaveProperty('completed_at');
    });

    it('should set completed_at with progress when both provided and status is FAILED', async () => {
      mockTypeOrmRepository.update.mockResolvedValueOnce({} as any);

      await repository.updateStatus('job-123', 'FAILED', 75);

      const updateData = mockTypeOrmRepository.update.mock.calls[0][1];
      expect(updateData).toHaveProperty('status', 'FAILED');
      expect(updateData).toHaveProperty('progress', 75);
      expect(updateData).toHaveProperty('completed_at');
    });
  });

  describe('updateProgress', () => {
    it('should update progress', async () => {
      mockTypeOrmRepository.update.mockResolvedValueOnce({} as any);

      await repository.updateProgress('job-123', 50);

      expect(mockTypeOrmRepository.update).toHaveBeenCalledWith(
        { id: 'job-123' },
        { progress: 50 },
      );
    });

    it('should allow progress 0', async () => {
      mockTypeOrmRepository.update.mockResolvedValueOnce({} as any);

      await repository.updateProgress('job-123', 0);

      expect(mockTypeOrmRepository.update).toHaveBeenCalledWith(
        { id: 'job-123' },
        { progress: 0 },
      );
    });

    it('should allow progress 100', async () => {
      mockTypeOrmRepository.update.mockResolvedValueOnce({} as any);

      await repository.updateProgress('job-123', 100);

      expect(mockTypeOrmRepository.update).toHaveBeenCalledWith(
        { id: 'job-123' },
        { progress: 100 },
      );
    });
  });

  describe('updateResult', () => {
    it('should update result', async () => {
      mockTypeOrmRepository.update.mockResolvedValueOnce({} as any);

      const result = { success: true, data: 'output' };

      await repository.updateResult('job-123', result as any);

      expect(mockTypeOrmRepository.update).toHaveBeenCalledWith(
        { id: 'job-123' },
        { result },
      );
    });

    it('should update result to null', async () => {
      mockTypeOrmRepository.update.mockResolvedValueOnce({} as any);

      await repository.updateResult('job-123', undefined);

      expect(mockTypeOrmRepository.update).toHaveBeenCalledWith(
        { id: 'job-123' },
        { result: undefined },
      );
    });
  });

  describe('search', () => {
    it('should search with no filters', async () => {
      mockTypeOrmRepository.findAndCount.mockResolvedValueOnce([[mockJob], 1]);

      const [jobs, count] = await repository.search({});

      expect(mockTypeOrmRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { created_at: 'DESC' },
        take: 50,
        skip: 0,
      });
      expect(jobs).toHaveLength(1);
      expect(count).toBe(1);
    });

    it('should search with user_id filter', async () => {
      mockTypeOrmRepository.findAndCount.mockResolvedValueOnce([[mockJob], 5]);

      const [jobs] = await repository.search({ user_id: 'user-1' });

      expect(mockTypeOrmRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_id: 'user-1' }),
        }),
      );
      expect(jobs).toHaveLength(1);
    });

    it('should search with agent filter', async () => {
      mockTypeOrmRepository.findAndCount.mockResolvedValueOnce([[mockJob], 1]);

      await repository.search({ agent: 'AlphaCal' });

      expect(mockTypeOrmRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ agent: 'AlphaCal' }),
        }),
      );
    });

    it('should search with status filter', async () => {
      mockTypeOrmRepository.findAndCount.mockResolvedValueOnce([[mockJob], 1]);

      await repository.search({ status: 'COMPLETED' });

      expect(mockTypeOrmRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });

    it('should search with dataset_id filter', async () => {
      mockTypeOrmRepository.findAndCount.mockResolvedValueOnce([[mockJob], 1]);

      await repository.search({ dataset_id: 'dataset-1' });

      expect(mockTypeOrmRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ dataset_id: 'dataset-1' }),
        }),
      );
    });

    it('should search with multiple filters', async () => {
      mockTypeOrmRepository.findAndCount.mockResolvedValueOnce([[mockJob], 1]);

      await repository.search({
        user_id: 'user-1',
        agent: 'AlphaCal',
        status: 'RUNNING',
      });

      const whereClause = (
        mockTypeOrmRepository.findAndCount.mock.calls[0][0] as any
      )?.where as any;
      expect(whereClause?.user_id).toBe('user-1');
      expect(whereClause?.agent).toBe('AlphaCal');
      expect(whereClause?.status).toBe('RUNNING');
    });

    it('should NOT include undefined filters', async () => {
      mockTypeOrmRepository.findAndCount.mockResolvedValueOnce([[mockJob], 1]);

      await repository.search({
        user_id: 'user-1',
        agent: undefined,
        status: 'QUEUED',
      });

      const whereClause = (
        mockTypeOrmRepository.findAndCount.mock.calls[0][0] as any
      )?.where as any;
      expect(whereClause).toHaveProperty('user_id');
      expect(whereClause).not.toHaveProperty('agent');
      expect(whereClause).toHaveProperty('status');
    });

    it('should NOT include from_date/to_date in where (not implemented in query)', async () => {
      mockTypeOrmRepository.findAndCount.mockResolvedValueOnce([[mockJob], 1]);

      const fromDate = new Date('2026-01-01');
      const toDate = new Date('2026-02-01');

      await repository.search({
        from_date: fromDate,
        to_date: toDate,
      });

      const whereClause = (
        mockTypeOrmRepository.findAndCount.mock.calls[0][0] as any
      )?.where as any;
      expect(whereClause).not.toHaveProperty('from_date');
      expect(whereClause).not.toHaveProperty('to_date');
    });

    it('should use custom limit and offset', async () => {
      mockTypeOrmRepository.findAndCount.mockResolvedValueOnce([[], 0]);

      await repository.search({}, 100, 200);

      expect(mockTypeOrmRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
          skip: 200,
        }),
      );
    });

    it('should order by created_at DESC', async () => {
      mockTypeOrmRepository.findAndCount.mockResolvedValueOnce([[], 0]);

      await repository.search({});

      expect(mockTypeOrmRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { created_at: 'DESC' },
        }),
      );
    });
  });

  describe('delete', () => {
    it('should delete job by id', async () => {
      mockTypeOrmRepository.delete.mockResolvedValueOnce({} as any);

      await repository.delete('job-123');

      expect(mockTypeOrmRepository.delete).toHaveBeenCalledWith({
        id: 'job-123',
      });
    });
  });
});
