import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import { TaccIntegrationService } from './tacc-integration.service';
import { JobOrchestratorService } from './services/job-orchestrator.service';
import type { BatchJobRequest, OptimizationTip } from './services/job-orchestrator.service';
import { DatasetStagingService } from './services/dataset-staging.service';
import type { StagingRequest, StagingStatus } from './services/dataset-staging.service';
import type { TaccJobSubmission } from './tacc-integration.service';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import type { AuthenticatedRequest } from '../types/http.types';
import { Job } from './entities/job.entity';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly taccService: TaccIntegrationService,
    private readonly orchestrator: JobOrchestratorService,
    private readonly datasetStaging: DatasetStagingService,
  ) {}

  /**
   * Submit a single job for processing
   */
  @Post('submit')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(201)
  async submitJob(
    @Request() req: AuthenticatedRequest,
    @Body() submission: TaccJobSubmission,
  ): Promise<Job> {
    return this.orchestrator.submitJob(req.user.id, submission);
  }

  /**
   * Submit multiple jobs in batch with controlled parallelism
   */
  @Post('submit-batch')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(201)
  async submitBatch(
    @Request() req: AuthenticatedRequest,
    @Body() batch: BatchJobRequest,
  ): Promise<Job[]> {
    return this.orchestrator.submitBatch(req.user.id, batch);
  }

  /**
   * Get detailed job status and progress
   */
  @Get(':id/status')
  @UseGuards(AuthenticatedGuard)
  async getJobStatus(@Param('id') jobId: string): Promise<Job | null> {
    return this.orchestrator.getJobStatus(jobId);
  }

  /**
   * Cancel a queued or running job
   */
  @Delete(':id')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(200)
  async cancelJob(@Param('id') jobId: string): Promise<{ success: boolean }> {
    const success = await this.orchestrator.cancelJob(jobId);
    return { success };
  }

  /**
   * Get job history for authenticated user
   */
  @Get('history/list')
  @UseGuards(AuthenticatedGuard)
  async getJobHistory(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ): Promise<{ jobs: Job[]; total: number }> {
    return this.orchestrator.getJobHistory(req.user.id, Number(limit), Number(offset));
  }

  /**
   * Search jobs with advanced filters
   */
  @Get('search')
  @UseGuards(AuthenticatedGuard)
  async searchJobs(
    @Request() req: AuthenticatedRequest,
    @Query() filters: Record<string, string | undefined>,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ): Promise<{ jobs: Job[]; total: number }> {
    return this.orchestrator.searchJobs(req.user.id, filters, Number(limit), Number(offset));
  }

  /**
   * Get optimization recommendations for a job configuration
   */
  @Post('optimize')
  @UseGuards(AuthenticatedGuard)
  async getOptimizationTips(@Body() submission: TaccJobSubmission): Promise<OptimizationTip[]> {
    return this.orchestrator.getOptimizationTips(submission);
  }

  /**
   * Get resource metrics and cost estimation for user
   */
  @Get('metrics')
  @UseGuards(AuthenticatedGuard)
  async getResourceMetrics(@Request() req: AuthenticatedRequest) {
    return this.orchestrator.getResourceMetrics(req.user.id);
  }

  /**
   * Query available GPU resource pools
   */
  @Get('resources/available')
  @UseGuards(AuthenticatedGuard)
  async getAvailableResources() {
    return this.orchestrator.getAvailableResourcePools();
  }

  /**
   * Stage dataset for processing (Phase 2: GLOBUS integration)
   */
  @Post('dataset/stage')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(202)
  async stageDataset(@Body() request: StagingRequest): Promise<StagingStatus> {
    return this.datasetStaging.stageDataset(request);
  }

  /**
   * Get dataset staging status
   */
  @Get('dataset/:id/staging-status')
  @UseGuards(AuthenticatedGuard)
  async getStagingStatus(@Param('id') datasetId: string): Promise<StagingStatus | null> {
    return this.datasetStaging.getStagingStatus(datasetId);
  }

  /**
   * Validate dataset readiness for processing
   */
  @Get('dataset/:id/validate')
  @UseGuards(AuthenticatedGuard)
  async validateDataset(@Param('id') datasetId: string) {
    return this.datasetStaging.validateDataset(datasetId);
  }

  /**
   * Get dataset optimization recommendations
   */
  @Get('dataset/:id/optimize')
  @UseGuards(AuthenticatedGuard)
  async optimizeDataset(@Param('id') datasetId: string) {
    return this.datasetStaging.optimizeDatasetLayout(datasetId);
  }

  /**
   * Estimate data transfer time
   */
  @Post('dataset/estimate-transfer')
  @UseGuards(AuthenticatedGuard)
  async estimateTransferTime(@Body() { size_gb }: { size_gb: number }) {
    return this.datasetStaging.estimateTransferTime(size_gb);
  }
}
