import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface DatasetInfo {
  id: string;
  name: string;
  size_gb: number;
  format: string;
  created_date: Date;
  ready_for_processing: boolean;
  staging_location?: string;
  staging_progress?: number; // 0-100
}

export interface StagingRequest {
  dataset_id: string;
  target_resource: 'tacc_scratch' | 'dvs';
  priority: 'normal' | 'high';
}

export interface StagingStatus {
  dataset_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number; // 0-100
  estimated_time_minutes?: number;
}

/**
 * Manages dataset preparation and staging for TACC processing
 * Phase 1: Simulated staging operations
 * Phase 2: Real GLOBUS transfer integration
 */
@Injectable()
export class DatasetStagingService implements OnModuleDestroy {
  private readonly logger = new Logger(DatasetStagingService.name);
  private stagingCache: Map<string, StagingStatus> = new Map();
  private readonly stagingIntervals = new Map<string, ReturnType<typeof setInterval>>();

  /**
   * Validate dataset readiness for processing
   */
  async validateDataset(datasetId: string): Promise<DatasetInfo> {
    this.logger.log(`Validating dataset: ${datasetId}`);

    // Simulate dataset lookup
    return {
      id: datasetId,
      name: `Dataset-${datasetId.slice(0, 8)}`,
      size_gb: Math.floor(Math.random() * 500) + 50, // 50-550 GB
      format: 'FITS',
      created_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      ready_for_processing: true,
      staging_location: `/tacc/scratch/${datasetId}`,
      staging_progress: 100,
    };
  }

  /**
   * Initiate dataset staging to target resource
   */
  async stageDataset(request: StagingRequest): Promise<StagingStatus> {
    const { dataset_id, target_resource, priority } = request;
    this.logger.log(`Staging dataset ${dataset_id} to ${target_resource} (priority: ${priority})`);

    // In phase 1, simulate staging
    // In phase 2, initiate actual GLOBUS transfer
    const stagingStatus: StagingStatus = {
      dataset_id,
      status: 'in_progress',
      progress: 0,
      estimated_time_minutes: priority === 'high' ? 15 : 45,
    };

    this.stagingCache.set(dataset_id, stagingStatus);

    // Simulate async staging
    this.simulateStagingProgress(dataset_id);

    return stagingStatus;
  }

  /**
   * Get dataset staging status
   */
  async getStagingStatus(datasetId: string): Promise<StagingStatus | null> {
    const cached = this.stagingCache.get(datasetId);
    
    if (cached) {
      return cached;
    }

    // Would query GLOBUS API in phase 2
    this.logger.debug(`No staging in progress for dataset ${datasetId}`);
    return null;
  }

  /**
   * Estimate transfer time based on size
   */
  estimateTransferTime(sizeGb: number): { minMinutes: number; maxMinutes: number } {
    // Assume 1 Gbps network bandwidth
    const estimatedSeconds = (sizeGb * 8) / 1; // 8 bits per byte, 1 Gbps
    const minMinutes = Math.ceil(estimatedSeconds / 60);
    const maxMinutes = Math.ceil(minMinutes * 1.5); // Add 50% buffer

    return { minMinutes, maxMinutes };
  }

  /**
   * Pre-validate dataset for optimal processing
   */
  async optimizeDatasetLayout(datasetId: string): Promise<{
    recommendations: string[];
    estimated_speedup: number;
  }> {
    this.logger.log(`Optimizing dataset layout for ${datasetId}`);

    const recommendations: string[] = [];
    let speedup = 1.0;

    // Check if data is already on fast tier
    recommendations.push('Data staging to NVMe tier for 3x faster I/O');
    speedup *= 3;

    recommendations.push('Verify FITS header alignment for sequential read efficiency');
    speedup *= 1.1;

    return {
      recommendations,
      estimated_speedup: speedup,
    };
  }

  /**
   * Simulate staging progress over time (for demo)
   */
  private simulateStagingProgress(datasetId: string): void {
    this.clearStagingInterval(datasetId);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      
      if (progress >= 100) {
        progress = 100;
        const status = this.stagingCache.get(datasetId);
        if (status) {
          status.status = 'completed';
          status.progress = 100;
        }
        clearInterval(interval);
        this.stagingIntervals.delete(datasetId);
      } else {
        const status = this.stagingCache.get(datasetId);
        if (status) {
          status.progress = Math.min(progress, 99);
        }
      }
    }, 2000);
    this.stagingIntervals.set(datasetId, interval);
  }

  onModuleDestroy(): void {
    this.stagingIntervals.forEach((intervalId) => clearInterval(intervalId));
    this.stagingIntervals.clear();
  }

  private clearStagingInterval(datasetId: string): void {
    const existing = this.stagingIntervals.get(datasetId);
    if (existing) {
      clearInterval(existing);
      this.stagingIntervals.delete(datasetId);
    }
  }
}
