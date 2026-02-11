import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TaccJobParams {
  rfi_strategy?: 'low' | 'medium' | 'high' | 'high_sensitivity';
  gpu_count?: number;
  max_runtime?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface TaccJobSubmission {
  agent: 'AlphaCal' | 'ImageReconstruction' | 'AnomalyDetection' | string;
  dataset_id: string;
  params: TaccJobParams;
}

export interface TaccJobStatus {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  output_url?: string;
}

@Injectable()
export class TaccIntegrationService {
  private readonly logger = new Logger(TaccIntegrationService.name);

  constructor(private readonly configService: ConfigService) {
    // Initializing these here but they will be used in the real implementation
    // For now, we fetch them to verify they exist but avoid the unused field error
    const taccApiBaseUrl = this.configService.get<string>('TACC_API_URL', 'https://api.tacc.utexas.edu');
    const taccApiKey = this.configService.get<string>('TACC_API_KEY', '');
    this.logger.debug(`TACC Integration initialized with URL: ${taccApiBaseUrl} (Key present: ${!!taccApiKey})`);
  }

  async submitJob(submission: TaccJobSubmission): Promise<{ jobId: string }> {
    this.logger.log(`Submitting TACC job for agent ${submission.agent} on dataset ${submission.dataset_id}`);
    
    // In a real implementation, this would call the TACC API Gateway
    // For the spike, we simulate the submission
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const simulatedJobId = `tacc-${Math.floor(Math.random() * 1000000)}`;
      
      this.logger.log(`Successfully submitted job: ${simulatedJobId}`);
      return { jobId: simulatedJobId };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during job submission';
      this.logger.error(`Failed to submit job to TACC: ${errorMessage}`);
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<TaccJobStatus> {
    this.logger.log(`Fetching status for TACC job: ${jobId}`);
    
    try {
      // Simulate status check
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const statuses: TaccJobStatus['status'][] = ['QUEUED', 'RUNNING', 'COMPLETED'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      
      return {
        id: jobId,
        status: randomStatus,
        progress: randomStatus === 'COMPLETED' ? 1.0 : 0.45,
        output_url: randomStatus === 'COMPLETED' ? 'https://archive.vla.nrao.edu/results/job-123.fits' : undefined,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during status fetch';
      this.logger.error(`Failed to fetch status for job ${jobId}: ${errorMessage}`);
      throw error;
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    this.logger.log(`Cancelling TACC job: ${jobId}`);
    
    try {
      // Simulate cancellation
      await new Promise(resolve => setTimeout(resolve, 300));
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during cancellation';
      this.logger.error(`Failed to cancel job ${jobId}: ${errorMessage}`);
      throw error;
    }
  }
}
