import { Test, TestingModule } from '@nestjs/testing';
import { AdminLogsController } from './admin-logs.controller';
import { LoggingService } from '../logging/logging.service';
import type { LogEntry } from '../logging/log-entry';
import { LogEntryBuilder } from '../testing/test-builders';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('AdminLogsController', () => {
  let controller: AdminLogsController;
  let service: jest.Mocked<LoggingService>;

  const mockLogEntry: LogEntry = new LogEntryBuilder()
    .withType('ACTION')
    .withSeverity('INFO')
    .withMessage('Test log message')
    .withContext('TestContext')
    .withMeta({ userId: 'user-1' })
    .build() as LogEntry;

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      controllers: [AdminLogsController],
      providers: [
        {
          provide: LoggingService,
          useValue: {
            getRecent: jest.fn(),
            getSummary: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = testingModule.get<AdminLogsController>(AdminLogsController);
    service = testingModule.get(LoggingService) as jest.Mocked<LoggingService>;
  });

  describe('list() - GET /admin/logs', () => {
    it('should return logs with default pagination', async () => {
      const mockLogs = [mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      const result = await controller.list(undefined, undefined);

      expect(result).toEqual({ data: mockLogs, total: 1 });
      expect(service.getRecent).toHaveBeenCalledWith(100, 0);
    });

    it('should return logs with custom offset and limit', async () => {
      const mockLogs = [mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      const result = await controller.list('10', '50');

      expect(result).toEqual({ data: mockLogs, total: 1 });
      expect(service.getRecent).toHaveBeenCalledWith(50, 10);
    });

    it('should handle offset=0 explicitly', async () => {
      const mockLogs = [mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      const result = await controller.list('0', '100');

      expect(result).toEqual({ data: mockLogs, total: 1 });
      expect(service.getRecent).toHaveBeenCalledWith(100, 0);
    });

    it('should handle limit=1 (minimum valid)', async () => {
      const mockLogs = [mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      const result = await controller.list('0', '1');

      expect(result).toEqual({ data: mockLogs, total: 1 });
      expect(service.getRecent).toHaveBeenCalledWith(1, 0);
    });

    it('should handle limit=500 (maximum valid)', async () => {
      const mockLogs = Array(500).fill(mockLogEntry);
      service.getRecent.mockResolvedValue(mockLogs);

      const result = await controller.list('0', '500');

      expect(result.total).toBe(500);
      expect(service.getRecent).toHaveBeenCalledWith(500, 0);
    });

    it('should reject limit>500 and use default (100)', async () => {
      const mockLogs = [mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      await controller.list('0', '501');

      expect(service.getRecent).toHaveBeenCalledWith(100, 0);
    });

    it('should reject limit=0 and use default (100)', async () => {
      const mockLogs = [mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      await controller.list('0', '0');

      expect(service.getRecent).toHaveBeenCalledWith(100, 0);
    });

    it('should reject negative limit and use default (100)', async () => {
      const mockLogs = [mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      await controller.list('0', '-50');

      expect(service.getRecent).toHaveBeenCalledWith(100, 0);
    });

    it('should reject negative offset and use 0', async () => {
      const mockLogs = [mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      await controller.list('-10', '50');

      expect(service.getRecent).toHaveBeenCalledWith(50, 0);
    });

    it('should handle non-numeric offset as 0', async () => {
      const mockLogs = [mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      await controller.list('invalid', '50');

      expect(service.getRecent).toHaveBeenCalledWith(50, 0);
    });

    it('should handle non-numeric limit as default (100)', async () => {
      const mockLogs = [mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      await controller.list('0', 'invalid');

      expect(service.getRecent).toHaveBeenCalledWith(100, 0);
    });

    it('should handle float offset by parsing as integer', async () => {
      const mockLogs = [mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      await controller.list('10.5', '50');

      expect(service.getRecent).toHaveBeenCalledWith(50, 10.5);
    });

    it('should handle float limit by parsing as number', async () => {
      const mockLogs = [mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      await controller.list('0', '50.9');

      expect(service.getRecent).toHaveBeenCalledWith(50.9, 0);
    });

    it('should return empty logs list', async () => {
      service.getRecent.mockResolvedValue([]);

      const result = await controller.list('0', '100');

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should return multiple logs', async () => {
      const mockLogs = [
        mockLogEntry,
        { ...mockLogEntry, message: 'Message 2' },
        { ...mockLogEntry, message: 'Message 3' },
      ];
      service.getRecent.mockResolvedValue(mockLogs);

      const result = await controller.list('0', '100');

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should handle large offset values', async () => {
      const mockLogs: LogEntry[] = [];
      service.getRecent.mockResolvedValue(mockLogs);

      const result = await controller.list('1000000', '100');

      expect(service.getRecent).toHaveBeenCalledWith(100, 1000000);
      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should handle undefined limit with valid offset', async () => {
      const mockLogs = [mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      await controller.list('5', undefined);

      expect(service.getRecent).toHaveBeenCalledWith(100, 5);
    });

    it('should handle undefined offset with valid limit', async () => {
      const mockLogs = [mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      await controller.list(undefined, '50');

      expect(service.getRecent).toHaveBeenCalledWith(50, 0);
    });

    it('should propagate service errors', async () => {
      service.getRecent.mockRejectedValue(new Error('Database error'));

      await expect(controller.list('0', '100')).rejects.toThrow('Database error');
    });

    it('should preserve log entry structure', async () => {
      const logsWithMeta: LogEntry[] = [
        new LogEntryBuilder()
          .withType('ACTION')
          .withSeverity('ERROR')
          .withMessage('Error message')
          .withContext('ErrorContext')
          .withMeta({ error: 'details', userId: 'user-2' })
          .build() as LogEntry,
      ];
      service.getRecent.mockResolvedValue(logsWithMeta);

      const result = await controller.list('0', '100');

      expect(result.data[0]).toEqual(logsWithMeta[0]);
    });
  });

  describe('summary() - GET /admin/logs/summary', () => {
    it('should return log summary', async () => {
      const mockSummary = {
        total: 1000,
        ERROR: 50,
        WARN: 150,
        INFO: 750,
        DEBUG: 50,
      };
      service.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.summary();

      expect(result).toEqual(mockSummary);
      expect(service.getSummary).toHaveBeenCalled();
    });

    it('should handle empty summary', async () => {
      const mockSummary = {};
      service.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.summary();

      expect(result).toEqual({});
    });

    it('should return summary with various log levels', async () => {
      const mockSummary = {
        TRACE: 100,
        DEBUG: 200,
        INFO: 300,
        WARN: 200,
        ERROR: 150,
        FATAL: 50,
      };
      service.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.summary();

      expect(result).toEqual(mockSummary);
    });

    it('should handle summary with zero counts', async () => {
      const mockSummary = {
        ERROR: 0,
        WARN: 0,
        INFO: 100,
        DEBUG: 0,
      };
      service.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.summary();

      expect(result).toEqual(mockSummary);
    });

    it('should propagate service errors from summary', async () => {
      service.getSummary.mockRejectedValue(new Error('Service error'));

      await expect(controller.summary()).rejects.toThrow('Service error');
    });

    it('should return numeric values in summary', async () => {
      const mockSummary = {
        total_requests: 5000,
        successful: 4900,
        failed: 100,
        average_response_time_ms: 250.5,
      };
      service.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.summary();

      expect(Number.isFinite(result.total_requests)).toBe(true);
      expect(Number.isFinite(result.average_response_time_ms)).toBe(true);
    });

    it('should be called independently of list', async () => {
      const mockSummary = { ERROR: 10, WARN: 20, INFO: 70 };
      service.getSummary.mockResolvedValue(mockSummary);

      await controller.summary();
      await controller.summary();

      expect(service.getSummary).toHaveBeenCalledTimes(2);
    });

    it('should handle large summary values', async () => {
      const mockSummary = {
        total: 1000000000,
        INFO: 999999900,
        ERROR: 100,
      };
      service.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.summary();

      expect(result.total).toBe(1000000000);
    });
  });

  describe('Parameter Validation', () => {
    it('should validate offset is non-negative', async () => {
      const mockLogs: LogEntry[] = [];
      service.getRecent.mockResolvedValue(mockLogs);

      await controller.list('-1', '10');

      expect(service.getRecent).toHaveBeenCalledWith(10, 0);
    });

    it('should validate limit is positive and within range', async () => {
      const mockLogs: LogEntry[] = [];
      service.getRecent.mockResolvedValue(mockLogs);

      await controller.list('0', '1001');

      expect(service.getRecent).toHaveBeenCalledWith(100, 0);
    });

    it('should handle all invalid parameter combinations', async () => {
      const mockLogs: LogEntry[] = [];
      service.getRecent.mockResolvedValue(mockLogs);

      await controller.list('-100', '-50');

      expect(service.getRecent).toHaveBeenCalledWith(100, 0);
    });
  });

  describe('Response Format', () => {
    it('should always return LogsResponse format', async () => {
      const mockLogs = [mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      const result = await controller.list('0', '100');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.total).toBe('number');
    });

    it('should set total to length of data array', async () => {
      const mockLogs = [mockLogEntry, mockLogEntry, mockLogEntry];
      service.getRecent.mockResolvedValue(mockLogs);

      const result = await controller.list('0', '100');

      expect(result.total).toBe(result.data.length);
    });

    it('should preserve log entry properties in response', async () => {
      const testLog: LogEntry = new LogEntryBuilder()
        .withType('ACTION')
        .withSeverity('WARN')
        .withMessage('Warning message')
        .withContext('WarningContext')
        .withMeta({ requestId: 'req-123', duration: 500 })
        .build() as LogEntry;
      service.getRecent.mockResolvedValue([testLog]);

      const result = await controller.list('0', '100');

      expect(result.data[0]).toEqual(testLog);
      expect(result.data[0].type).toBe(testLog.type);
      expect(result.data[0].severity).toBe(testLog.severity);
    });
  });
});
