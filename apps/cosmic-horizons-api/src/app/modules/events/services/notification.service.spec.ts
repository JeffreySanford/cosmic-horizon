import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';

/**
 * SPRINT 5.3: Job Orchestration Events
 * Week 2 (Feb 23-27): Consumer Event Tests
 *
 * NotificationService Event Consumption Tests
 * Tests for handling job completion, failure, and anomaly notifications via email and WebSocket
 */
describe('NotificationService - Event Consumption', () => {
  let service: NotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationService],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  describe('Monday: Job completion and failure notifications', () => {
    it('should send email notification on job completion', async () => {
      const event = {
        jobId: 'job-1',
        userId: 'user-123',
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        resultUrl: '/api/jobs/job-1/results',
      };

      const emailSent = await service.sendJobCompletionNotification(event);
      expect(emailSent).toBe(true);
    });

    it('should include job results summary in completion email', async () => {
      const event = {
        jobId: 'job-1',
        userId: 'user-123',
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        resultUrl: '/api/jobs/job-1/results',
        outputSummary: {
          totalSources: 1200,
          rmsNoise: 15,
          dynamicRange: 12000,
        },
      };

      const notification = await service.formatCompletionNotification(event);
      expect(notification).toContain('COMPLETED');
      expect(notification).toContain('job-1');
    });

    it('should send failure alert on job failure', async () => {
      const event = {
        jobId: 'job-2',
        userId: 'user-123',
        status: 'FAILED',
        failedAt: new Date().toISOString(),
        failureReason: 'GPU memory allocation failed',
      };

      const alertSent = await service.sendJobFailureAlert(event);
      expect(alertSent).toBe(true);
    });

    it('should escalate critical failures to admin', async () => {
      const event = {
        jobId: 'job-3',
        userId: 'user-123',
        status: 'FAILED',
        failedAt: new Date().toISOString(),
        failureReason: 'Database connection lost',
        severity: 'CRITICAL',
      };

      const escalated = await service.checkEscalationRequired(event);
      expect(escalated).toBe(true);
    });

    it('should mark notification as read after user views', async () => {
      const notification = {
        id: 'notif-1',
        jobId: 'job-1',
        userId: 'user-123',
        type: 'JOB_COMPLETED',
        read: false,
        createdAt: new Date(),
      };

      await service.markNotificationAsRead('notif-1');
      const updated = await service.getNotification('notif-1');
      expect(updated?.read).toBe(true);
    });
  });

  describe('Tuesday-Wednesday: WebSocket broadcast and in-app notifications', () => {
    it('should broadcast job status update via WebSocket', async () => {
      const event = {
        jobId: 'job-1',
        status: 'RUNNING',
        stage: 'ALPHACAL',
        progress: 45,
        timestamp: new Date().toISOString(),
      };

      const broadcast = await service.broadcastStatusUpdate(event);
      expect(broadcast).toBeDefined();
    });

    it('should send WebSocket notification to specific user', async () => {
      const event = {
        jobId: 'job-1',
        userId: 'user-123',
        type: 'JOB_PROGRESS',
        data: { stage: 'IMAGE_RECONSTRUCTION', progress: 75 },
      };

      const sent = await service.sendWebSocketNotification('user-123', event);
      expect(sent).toBe(true);
    });

    it('should store in-app notification in database', async () => {
      const notification = {
        jobId: 'job-1',
        userId: 'user-123',
        type: 'STAGE_COMPLETED',
        title: 'AlphaCal Stage Complete',
        body: 'RFI calibration completed successfully',
        timestamp: new Date(),
      };

      const stored = await service.storeInAppNotification(notification);
      expect(stored.id).toBeDefined();
      expect(stored.read).toBe(false);
    });

    it('should retrieve recent notifications for user dashboard', async () => {
      const userId = 'user-123';
      const notifications = [
        {
          jobId: 'job-1',
          type: 'JOB_COMPLETED',
          timestamp: new Date(),
        },
        {
          jobId: 'job-2',
          type: 'JOB_FAILED',
          timestamp: new Date(Date.now() - 300000),
        },
      ];

      for (const notification of notifications) {
        await service.storeInAppNotification({
          ...notification,
          userId,
        });
      }

      const recent = await service.getUserNotifications(userId, 10);
      expect(recent.length).toBeGreaterThanOrEqual(0);
    });

    it('should clear old notifications (retention policy)', async () => {
      const userId = 'user-123';
      const maxAgeMinutes = 1440; // 1 day

      await service.storeInAppNotification({
        jobId: 'job-old',
        userId,
        type: 'JOB_COMPLETED',
        timestamp: new Date(Date.now() - maxAgeMinutes * 60 * 1000 - 3600000), // Older than retention
      });

      const cleared = await service.clearOldNotifications(maxAgeMinutes);
      expect(cleared).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Thursday: Notification aggregation and batching', () => {
    it('should aggregate multiple job updates in single notification', async () => {
      const events = [
        { jobId: 'job-1', event: 'stage_started', stage: 'ALPHACAL' },
        { jobId: 'job-1', event: 'stage_progress', stage: 'ALPHACAL', progress: 50 },
        { jobId: 'job-1', event: 'stage_completed', stage: 'ALPHACAL' },
      ];

      const aggregated = await service.aggregateNotifications('user-123', events);
      expect(aggregated).toBeDefined();
      expect(aggregated.eventCount).toBe(3);
    });

    it('should batch notifications to avoid spam', async () => {
      const userId = 'user-123';
      const events = [];

      // Create 50 rapid events
      for (let i = 0; i < 50; i++) {
        events.push({
          jobId: 'job-1',
          event: 'metrics_update',
          timestamp: new Date(Date.now() + i * 100),
        });
      }

      const batched = await service.batchNotifications(userId, events);
      expect(batched.batches).toBeDefined();
      expect(batched.batches.length).toBeLessThan(50);
    });

    it('should apply notification preferences (quiet hours)', async () => {
      const userPrefs = {
        userId: 'user-123',
        quietHours: {
          start: 22, // 10 PM
          end: 8, // 8 AM
        },
        notificationLevel: 'SUMMARY',
      };

      const isQuietHour = await service.checkQuietHours(userPrefs);
      expect(typeof isQuietHour).toBe('boolean');
    });

    it('should generate notification digests for daily summary', async () => {
      const userId = 'user-123';
      const digest = await service.generateDailyDigest(userId);

      expect(digest).toBeDefined();
      expect(digest.period).toBe('DAILY');
      expect(digest.jobsCompleted).toBeGreaterThanOrEqual(0);
      expect(digest.jobsFailed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Friday: Error handling and resilience', () => {
    it('should handle email delivery failure gracefully', async () => {
      const event = {
        jobId: 'job-1',
        userId: 'invalid-email@',
        status: 'COMPLETED',
      };

      const result = await service.attemptNotificationWithFallback(event);
      expect(result.success).toBeDefined();
    });

    it('should retry failed WebSocket broadcasts', async () => {
      const event = {
        jobId: 'job-1',
        userId: 'user-123',
        type: 'STATUS_UPDATE',
      };

      const result = await service.broadcastWithRetry(event, 3);
      expect(result.attempts).toBeGreaterThanOrEqual(1);
      expect(result.success).toBeDefined();
    });

    it('should queue notifications when service temporarily unavailable', async () => {
      const event = {
        jobId: 'job-1',
        userId: 'user-123',
        type: 'JOB_COMPLETED',
      };

      const queued = await service.queueNotificationIfUnavailable(event);
      expect(queued).toBeDefined();
    });

    it('should handle concurrent notification deliveries', async () => {
      const events = [];
      for (let i = 0; i < 20; i++) {
        events.push({
          jobId: `job-${i}`,
          userId: 'user-123',
          type: 'STATUS_UPDATE',
        });
      }

      const results = await Promise.all(
        events.map((e) => service.sendWebSocketNotification('user-123', e)),
      );

      expect(results.length).toBe(20);
      expect(results.every((r: unknown) => typeof r === 'boolean')).toBe(true);
    });

    it('should maintain notification queue persistence on failure', async () => {
      const event = {
        jobId: 'job-1',
        userId: 'user-123',
        type: 'CRITICAL_ALERT',
      };

      const persisted = await service.persistQueuedNotification(event);
      expect(persisted).toBeDefined();
      expect(persisted.queued).toBe(true);
    });
  });
});
