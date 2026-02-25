import {
  Injectable,
  Logger,
  OnModuleDestroy,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

export interface DatasetInfo {
  id: string;
  name: string;
  size_gb: number;
  format: string;
  created_date: Date;
  ready_for_processing: boolean;
  staging_location?: string;
  staging_progress?: number; // 0-100
  files?: string[]; // file list when modeling file manifest
}

export interface StagingRequest {
  dataset_id: string;
  target_resource: 'tacc_scratch' | 'dvs';
  priority: 'normal' | 'high';
}

export interface ArtifactRef {
  url: string;
  checksum: string;
}

export interface StagingStatus {
  dataset_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number; // 0-100
  estimated_time_minutes?: number;
  artifact_url?: string; // URL of packaged outputs when complete
  artifact_refs?: ArtifactRef[];
  output_manifest?: string[]; // list of output files
  error_code?: string; // human-readable error identifier
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
  private readonly stagingIntervals = new Map<
    string,
    ReturnType<typeof setInterval>
  >();

  /**
   * Validate dataset readiness for processing
   */
  async validateDataset(datasetId: string): Promise<DatasetInfo> {
    this.logger.log(`Validating dataset: ${datasetId}`);

    // simulate error conditions based on dataset id to support tests/demo realism
    if (datasetId.includes('notfound')) {
      this.logger.warn(`Dataset ${datasetId} not found`);
      throw new NotFoundException('Dataset not found');
    }
    if (datasetId.includes('forbidden')) {
      this.logger.warn(`Access to dataset ${datasetId} forbidden`);
      throw new ForbiddenException('Access denied');
    }

    // Build base info
    const info: DatasetInfo = {
      id: datasetId,
      name: `Dataset-${datasetId.slice(0, 8)}`,
      size_gb: Math.floor(Math.random() * 500) + 50, // 50-550 GB
      format: 'FITS',
      created_date: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
      ),
      ready_for_processing: true,
      staging_location: `/tacc/scratch/${datasetId}`,
      staging_progress: 100,
    };

    // if the id contains "manifest" return a fake file list
    if (datasetId.includes('manifest')) {
      info.files = Array.from({ length: 5 }, (_, i) => `file_${i + 1}.fits`);
    }

    return info;
  }

  /**
   * Initiate dataset staging to target resource
   */
  async stageDataset(request: StagingRequest): Promise<StagingStatus> {
    const { dataset_id, target_resource, priority } = request;
    this.logger.log(
      `Staging dataset ${dataset_id} to ${target_resource} (priority: ${priority})`,
    );

    // simulate immediate failures for certain ids
    if (dataset_id.includes('error')) {
      const failStatus: StagingStatus = {
        dataset_id,
        status: 'failed',
        progress: 0,
        estimated_time_minutes: 0,
        error_code: 'SIMULATED_FAILURE',
      };
      this.stagingCache.set(dataset_id, failStatus);
      return failStatus;
    }

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
  estimateTransferTime(sizeGb: number): {
    minMinutes: number;
    maxMinutes: number;
  } {
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

    recommendations.push(
      'Verify FITS header alignment for sequential read efficiency',
    );
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
          // when complete, simulate artifact packaging URL and optional refs
          status.artifact_url = `https://archive.example.com/${datasetId}.zip`;

          // add artifact refs with checksums
          status.artifact_refs = [
            {
              url: status.artifact_url,
              checksum: Math.random().toString(36).substring(2, 10),
            },
          ];

          // optionally delay output manifest if id contains 'delay'
          if (datasetId.includes('delay')) {
            status.status = 'in_progress';
            status.progress = 100;
            // schedule second stage to mark complete later
            setTimeout(() => {
              const s2 = this.stagingCache.get(datasetId);
              if (s2) {
                s2.status = 'completed';
                s2.output_manifest = ['result1.fits', 'result2.fits'];
              }
            }, 10000);
          } else {
            status.output_manifest = ['result1.fits', 'result2.fits'];
            status.status = 'completed';
          }
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
