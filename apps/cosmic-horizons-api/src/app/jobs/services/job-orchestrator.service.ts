import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  generateEventId,
  EventBase,
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

export interface PreflightQaResponse {
  answer: string;
  confidence: 'low' | 'medium' | 'high';
  caveats: string[];
  source: 'llm' | 'heuristic';
}

interface CompletedJobWithTimestamp extends Job {
  completed_at: Date;
}

@Injectable()
export class JobOrchestratorService {
  private readonly logger = new Logger(JobOrchestratorService.name);

  constructor(
    private readonly config: ConfigService,
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
      // make sure we have correlation id for headers (payload may include it)
      const p = payload as Record<string, unknown>;
      const correlation =
        (p.correlation_id as string) ||
        (p.correlationId as string) ||
        generateCorrelationId();
      const user = (p.user_id as string) || (p.userId as string) || '';

      const event: EventBase = {
        event_id: generateEventId(),
        event_type: eventType,
        timestamp: new Date().toISOString(),
        correlation_id: correlation,
        user_id: user,
        schema_version: 1,
        payload: {
          job_id: jobId,
          ...payload,
        },
      };

      await this.kafkaService.publishJobLifecycleEvent(event, jobId);
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
        await this.jobRepository.updateTaccJobId(job.id, result.jobId);
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to submit job ${job.id}: ${errorMessage}`);
      await this.jobRepository.updateResult(job.id, {
        error_message: errorMessage,
      });
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
            error_message: errorMessage,
            logs_path: `/jobs/${job.id}/logs`,
          },
        );

        await this.eventsService.publishJobEvent(failedEvent);
        this.logger.debug(`Published job.failed event (${job.id})`);

        // Publish to Kafka for audit trail (Sprint 5.3)
        await this.publishJobEventToKafka('job.failed', job.id, {
          failed_at: new Date().toISOString(),
          error_code: 500,
          error_message: errorMessage,
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
      const nextStatus =
        taccStatus.status === 'QUEUED'
          ? 'QUEUING'
          : (taccStatus.status as Job['status']);

      // Update local record
      if (nextStatus === 'RUNNING' || nextStatus === 'QUEUING') {
        await this.jobRepository.updateStatus(
          jobId,
          nextStatus,
          taccStatus.progress,
        );
      } else {
        await this.jobRepository.updateProgress(jobId, taccStatus.progress);
      }

      if (nextStatus === 'COMPLETED' || nextStatus === 'FAILED') {
        const resultPayload =
          nextStatus === 'FAILED'
            ? {
                error_message:
                  taccStatus.error_message ??
                  'Remote compute reported job failure without details.',
              }
            : {
                output_url: taccStatus.output_url,
              };
        await this.jobRepository.updateStatus(
          jobId,
          nextStatus,
          taccStatus.progress,
        );
        await this.jobRepository.updateResult(jobId, resultPayload);
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

  async answerPreflightQuestion(
    question: string,
    submission: TaccJobSubmission,
  ): Promise<PreflightQaResponse> {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      return {
        answer:
          'Ask a specific question about runtime, cost, failure modes, or workflow order.',
        confidence: 'low',
        caveats: ['No question content was provided.'],
        source: 'heuristic',
      };
    }

    const mode = (
      this.config.get<string>('REMOTE_COMPUTE_MODE') ??
      (this.config.get('TACC_LIVE') === 'true' ? 'live' : 'demo')
    ).toLowerCase();

    if (mode === 'local-llm') {
      const llmResponse = await this.tryLocalLlmPreflightAnswer(
        trimmedQuestion,
        submission,
      );
      if (llmResponse) {
        return llmResponse;
      }
    }

    return this.buildHeuristicPreflightAnswer(trimmedQuestion, submission);
  }

  private buildHeuristicPreflightAnswer(
    question: string,
    submission: TaccJobSubmission,
  ): PreflightQaResponse {
    const q = question.toLowerCase();
    const gpu = Number(submission.params.gpu_count ?? 1);
    const rfi = String(submission.params.rfi_strategy ?? 'medium');
    const productGoal = String(submission.params.product_goal ?? 'unspecified');
    const agent = String(submission.agent);
    const target = String(submission.params.target_name ?? 'target field');

    if (q.includes('what') && q.includes('do')) {
      return {
        answer:
          `${agent} will process ${submission.dataset_id} for ${target} with goal "${productGoal}". ` +
          `Current configuration requests ${gpu} GPU(s) and RFI strategy "${rfi}".`,
        confidence: 'high',
        caveats: [
          'This summarizes intent; final runtime behavior depends on backend mode and queue conditions.',
        ],
        source: 'heuristic',
      };
    }

    if (q.includes('gpu') || q.includes('cost')) {
      const advice =
        gpu <= 1
          ? 'Start with 1-2 GPUs for cost control, then scale only if runtime is too high.'
          : gpu > 4
            ? 'GPU count above 4 may increase cost with diminishing returns for smaller datasets.'
            : 'GPU allocation is in a balanced range for most pre-production runs.';
      return {
        answer: advice,
        confidence: 'medium',
        caveats: [
          'Actual cost depends on queue policy, walltime, and allocation accounting rules.',
        ],
        source: 'heuristic',
      };
    }

    if (q.includes('fail') || q.includes('risk')) {
      return {
        answer:
          'Most common risks are invalid dataset references, overly aggressive runtime/resource requests, and mode/backend mismatches.',
        confidence: 'medium',
        caveats: [
          'Live-mode risks include credential, tenant, or endpoint failures not visible in demo mode.',
        ],
        source: 'heuristic',
      };
    }

    return {
      answer: `For ${agent} on ${target}, verify dataset ID, RA/Dec, band, runtime limit, and resource settings before submission.`,
      confidence: 'medium',
      caveats: ['This is advisory guidance and not a scheduler guarantee.'],
      source: 'heuristic',
    };
  }

  private async tryLocalLlmPreflightAnswer(
    question: string,
    submission: TaccJobSubmission,
  ): Promise<PreflightQaResponse | null> {
    const baseUrl = this.config.get<string>(
      'OLLAMA_BASE_URL',
      'http://localhost:11435',
    );
    const model = this.config.get<string>('OLLAMA_MODEL', 'qwen3:8b');
    const timeoutMs = Number(
      this.config.get<number>('OLLAMA_TIMEOUT_MS', 30000),
    );

    const prompt = [
      'You are a cautious astronomy operations assistant.',
      'Answer pre-run job questions with concise practical guidance.',
      'Always include uncertainty and avoid guarantees.',
      `Question: ${question}`,
      `Job context JSON: ${JSON.stringify(submission)}`,
      'Return strict JSON: {"answer":"...","confidence":"low|medium|high","caveats":["..."]}',
    ].join('\n');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          format: 'json',
          prompt,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as { response?: string };
      if (!payload.response) {
        return null;
      }

      const parsed = JSON.parse(
        payload.response,
      ) as Partial<PreflightQaResponse>;
      if (
        typeof parsed.answer !== 'string' ||
        (parsed.confidence !== 'low' &&
          parsed.confidence !== 'medium' &&
          parsed.confidence !== 'high')
      ) {
        return null;
      }

      const caveats = Array.isArray(parsed.caveats)
        ? parsed.caveats.filter((c): c is string => typeof c === 'string')
        : ['Model response did not include explicit caveats.'];

      return {
        answer: parsed.answer,
        confidence: parsed.confidence,
        caveats,
        source: 'llm',
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
