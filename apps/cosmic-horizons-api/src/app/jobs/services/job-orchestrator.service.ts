import { Injectable, Logger } from '@nestjs/common';
import {
  TaccIntegrationService,
  TaccJobSubmission,
} from '../tacc-integration.service';
import { JobRepository } from '../repositories/job.repository';
import { Job } from '../entities/job.entity';
import { EventsService } from '../../modules/events/events.service';
import { KafkaService } from '../../modules/events/kafka.service';
import {
  createEventBase,
  generateCorrelationId,
} from '@cosmic-horizons/event-models';

export interface BatchJobRequest {
  jobs: TaccJobSubmission[];
  parallelLimit?: number;
  notifyOnCompletion?: boolean;
}

export interface OptimizationTip {
  category: 'memory' | 'gpu' | 'runtime' | 'rfi_strategy' | 'cost';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestedValue?: string | number;
}

export interface ResourceMetrics {
  totalGpuCount: number;
  averageRuntime: number;
  estimatedCost: number;
  successRate: number;
}

interface CompletedJobWithTimestamp extends Job {
  completed_at: Date;
}

@Injectable()
export class JobOrchestratorService {
  private readonly logger = new Logger(JobOrchestratorService.name);

  constructor(
    private readonly taccService: TaccIntegrationService,
    private readonly jobRepository: JobRepository,
    private readonly eventsService: EventsService,
    private readonly kafkaService: KafkaService,
  ) {}

  /**
   * Publish job notification events to Kafka
   * Used for external system integration (metrics, notifications, audit)
   */
  private async publishJobEventToKafka(
    eventType: string,
    jobId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.kafkaService.publishJobLifecycleEvent(
        {
          event_type: eventType,
          job_id: jobId,
          ...payload,
          timestamp: new Date().toISOString(),
        },
        jobId, // partition key for ordering
      );
    } catch (error) {
      this.logger.warn(
        `Failed to publish ${eventType} to Kafka: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Non-blocking - don't fail job operations for Kafka publish failures
    }
  }

  /**
   * Publish metrics for completed job
   */
  async publishCompletedJobMetrics(
    jobId: string,
    metrics: {
      executionTimeSeconds: number;
      cpuUsagePercent: number;
      memoryUsageMb: number;
    },
  ): Promise<void> {
    try {
      await this.kafkaService.publishJobMetrics(
        {
          event_type: 'job.metrics_recorded',
          job_id: jobId,
          cpu_usage_percent: metrics.cpuUsagePercent,
          memory_usage_mb: metrics.memoryUsageMb,
          execution_time_seconds: metrics.executionTimeSeconds,
        },
        jobId, // partition key
      );
    } catch (error) {
      this.logger.warn(
        `Failed to publish metrics for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Submit a single job for processing
   *
   * Publishes job.submitted event to RabbitMQ and Kafka
   * Uses correlation ID for tracing job → status → notification chain
   */
  async submitJob(userId: string, submission: TaccJobSubmission): Promise<Job> {
    const correlationId = generateCorrelationId();
    this.logger.log(
      `User ${userId} submitting job for agent: ${submission.agent} (trace: ${correlationId})`,
    );

    // Create job record
    const job = await this.jobRepository.create({
      user_id: userId,
      agent: submission.agent,
      dataset_id: submission.dataset_id,
      params: submission.params,
      gpu_count: submission.params.gpu_count,
    });

    // Publish job.submitted event (Phase 3)
    try {
      const jobSubmittedEvent = createEventBase(
        'job.submitted',
        userId,
        correlationId,
        {
          job_id: job.id,
          project_id: submission.dataset_id,
          user_id: userId,
          job_name: job.agent,
          tacc_system: 'stampede3', // TODO: Make configurable
          estimated_runtime_minutes:
            submission.params.max_runtime_minutes || 60,
          num_nodes: submission.params.num_nodes || 1,
          created_at: new Date().toISOString(),
        },
        { event_id: job.id + '-submitted' }, // Use job ID for idempotency
      );

      await this.eventsService.publishJobEvent(jobSubmittedEvent);
      this.logger.debug(`Published job.submitted event (${job.id})`);

      // Publish to Kafka for durability and external system integration (Sprint 5.3)
      await this.publishJobEventToKafka('job.submitted', job.id, {
        user_id: userId,
        project_id: submission.dataset_id,
        agent: submission.agent,
        gpu_count: submission.params.gpu_count,
        num_nodes: submission.params.num_nodes || 1,
        created_at: new Date().toISOString(),
        correlation_id: correlationId,
      });
    } catch (eventError) {
      this.logger.warn(
        `Failed to publish job.submitted event: ${eventError}`,
        eventError,
      );
      // Continue despite event publishing failure - events are non-blocking
    }

    try {
      // Submit to TACC
      const result = await this.taccService.submitJob(submission);

      // Update with TACC job ID and status
      const previousStatus = job.status;
      await this.jobRepository.updateStatus(job.id, 'QUEUING');
      const updatedJob = await this.jobRepository.findById(job.id);

      if (updatedJob) {
        updatedJob.tacc_job_id = result.jobId;
        await this.jobRepository.updateResult(job.id, {});
      }

      // Publish job.status.changed event (Phase 3)
      try {
        const statusChangedEvent = createEventBase(
          'job.status.changed',
          userId,
          correlationId,
          {
            job_id: job.id,
            previous_status: previousStatus,
            new_status: 'QUEUING',
            timestamp: new Date().toISOString(),
            reason: 'Job submitted to TACC',
          },
        );

        await this.eventsService.publishJobEvent(statusChangedEvent);
        this.logger.debug(`Published job.status.changed event (${job.id})`);

        // Publish to Kafka for state tracking (Sprint 5.3)
        await this.publishJobEventToKafka('job.status.changed', job.id, {
          previous_status: previousStatus,
          new_status: 'QUEUING',
          reason: 'Job submitted to TACC',
          timestamp: new Date().toISOString(),
        });
      } catch (eventError) {
        this.logger.warn(
          `Failed to publish job.status.changed event: ${eventError}`,
          eventError,
        );
      }

      return updatedJob || job;
    } catch (error) {
      this.logger.error(`Failed to submit job ${job.id}: ${error}`);
      await this.jobRepository.updateStatus(job.id, 'FAILED');

      // Publish job.failed event (Phase 3)
      try {
        const failedEvent = createEventBase(
          'job.failed',
          userId,
          correlationId,
          {
            job_id: job.id,
            failed_at: new Date().toISOString(),
            error_code: 500,
            error_message:
              error instanceof Error ? error.message : 'Unknown error',
            logs_path: `/jobs/${job.id}/logs`,
          },
        );

        await this.eventsService.publishJobEvent(failedEvent);
        this.logger.debug(`Published job.failed event (${job.id})`);

        // Publish to Kafka for audit trail (Sprint 5.3)
        await this.publishJobEventToKafka('job.failed', job.id, {
          failed_at: new Date().toISOString(),
          error_code: 500,
          error_message:
            error instanceof Error ? error.message : 'Unknown error',
          logs_path: `/jobs/${job.id}/logs`,
        });
      } catch (eventError) {
        this.logger.warn(
          `Failed to publish job.failed event: ${eventError}`,
          eventError,
        );
      }

      throw error;
    }
  }

  /**
   * Submit multiple jobs with controlled parallelism
   */
  async submitBatch(userId: string, batch: BatchJobRequest): Promise<Job[]> {
    const { jobs, parallelLimit = 3 } = batch;
    this.logger.log(
      `Submitting batch of ${jobs.length} jobs for user ${userId}`,
    );

    const results: Job[] = [];
    for (let i = 0; i < jobs.length; i += parallelLimit) {
      const chunk = jobs.slice(i, i + parallelLimit);
      const chunkResults = await Promise.all(
        chunk.map((job) => this.submitJob(userId, job).catch(() => null)),
      );
      results.push(...chunkResults.filter((j): j is Job => j !== null));
    }

    return results;
  }

  /**
   * Get detailed job status and progress
   */
  async getJobStatus(jobId: string): Promise<Job | null> {
    const job = await this.jobRepository.findById(jobId);

    if (!job) {
      return null;
    }

    // If job has TACC ID, fetch latest status
    if (job.tacc_job_id && ['QUEUING', 'RUNNING'].includes(job.status)) {
      const taccStatus = await this.taccService.getJobStatus(job.tacc_job_id);

      // Update local record
      await this.jobRepository.updateProgress(jobId, taccStatus.progress);

      if (taccStatus.status === 'COMPLETED' || taccStatus.status === 'FAILED') {
        await this.jobRepository.updateStatus(
          jobId,
          taccStatus.status,
          taccStatus.progress,
        );
        await this.jobRepository.updateResult(jobId, {
          output_url: taccStatus.output_url,
        });
      }
    }

    return this.jobRepository.findById(jobId);
  }

  /**
   * Query optimization recommendations based on job configuration
   */
  async getOptimizationTips(
    submission: TaccJobSubmission,
  ): Promise<OptimizationTip[]> {
    const tips: OptimizationTip[] = [];
    const { params } = submission;

    // GPU optimization
    if (!params.gpu_count || params.gpu_count < 1) {
      tips.push({
        category: 'gpu',
        severity: 'warning',
        message:
          'GPU count not specified. Recommend at least 1 GPU for image reconstruction.',
        suggestedValue: 2,
      });
    } else if (params.gpu_count > 4) {
      tips.push({
        category: 'cost',
        severity: 'info',
        message: `Using ${params.gpu_count} GPUs will increase compute cost. Verify parallelization benefit.`,
      });
    }

    // RFI strategy optimization
    if (!params.rfi_strategy) {
      tips.push({
        category: 'rfi_strategy',
        severity: 'warning',
        message:
          'RFI strategy not specified. Recommend "medium" for balanced accuracy and performance.',
        suggestedValue: 'medium',
      });
    }

    // Runtime estimation
    if (
      params.rfi_strategy === 'high' ||
      params.rfi_strategy === 'high_sensitivity'
    ) {
      tips.push({
        category: 'runtime',
        severity: 'info',
        message:
          'High RFI strategy will increase runtime. Expected 2-3x longer processing time.',
      });
    }

    // Memory estimate
    if (!params.max_runtime) {
      tips.push({
        category: 'runtime',
        severity: 'info',
        message:
          'No max runtime specified. Recommend 24-48 hours for large datasets.',
        suggestedValue: '48h',
      });
    }

    return tips;
  }

  /**
   * Get resource metrics for cost estimation
   */
  async getResourceMetrics(userId: string): Promise<ResourceMetrics> {
    const [jobs] = await this.jobRepository.findByUser(userId, 1000, 0);

    const completedJobs = jobs.filter(
      (job): job is CompletedJobWithTimestamp =>
        job.status === 'COMPLETED' && job.completed_at instanceof Date,
    );
    const totalGpuCount = jobs.reduce((sum, j) => sum + (j.gpu_count || 0), 0);

    const runtimesMs = completedJobs
      .map((job) => job.completed_at.getTime() - job.created_at.getTime())
      .filter((rt) => rt > 0);
    const averageRuntime =
      runtimesMs.length > 0
        ? runtimesMs.reduce((a, b) => a + b) / runtimesMs.length
        : 0;

    const successCount = jobs.filter((j) => j.status === 'COMPLETED').length;
    const successRate =
      jobs.length > 0 ? (successCount / jobs.length) * 100 : 0;

    // Rough cost estimation: $0.35 per GPU-hour
    const estimatedCost = totalGpuCount * (averageRuntime / 3600000) * 0.35;

    return {
      totalGpuCount,
      averageRuntime,
      estimatedCost,
      successRate,
    };
  }

  /**
   * Query available GPU resource pools (stubbed for next phase)
   */
  async getAvailableResourcePools(): Promise<
    Array<{
      name: string;
      totalGpus: number;
      availableGpus: number;
      queueWaitTime: number; // minutes
    }>
  > {
    // In phase 2, this will query TACC's resource availability API
    return [
      {
        name: 'GPU-V100',
        totalGpus: 128,
        availableGpus: 45,
        queueWaitTime: 12,
      },
      {
        name: 'GPU-A100',
        totalGpus: 64,
        availableGpus: 8,
        queueWaitTime: 240,
      },
    ];
  }

  /**
   * Get job history for user
   */
  async getJobHistory(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ jobs: Job[]; total: number }> {
    const [jobs, total] = await this.jobRepository.findByUser(
      userId,
      limit,
      offset,
    );
    return { jobs, total };
  }

  /**
   * Search jobs with advanced filters
   */
  async searchJobs(
    userId: string,
    filters: Record<string, unknown>,
    limit = 50,
    offset = 0,
  ): Promise<{ jobs: Job[]; total: number }> {
    const [jobs, total] = await this.jobRepository.search(
      { ...filters, user_id: userId },
      limit,
      offset,
    );
    return { jobs, total };
  }

  /**
   * Cancel a queued or running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.jobRepository.findById(jobId);

    if (!job) {
      return false;
    }

    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
      return false; // Cannot cancel completed jobs
    }

    if (job.tacc_job_id) {
      await this.taccService.cancelJob(job.tacc_job_id);
    }

    await this.jobRepository.updateStatus(jobId, 'CANCELLED');

    // Publish status change to Kafka for tracking (Sprint 5.3)
    try {
      await this.publishJobEventToKafka('job.cancelled', jobId, {
        previous_status: job.status,
        new_status: 'CANCELLED',
        cancelled_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to publish job.cancelled event to Kafka: ${error}`,
      );
    }

    return true;
  }
}
