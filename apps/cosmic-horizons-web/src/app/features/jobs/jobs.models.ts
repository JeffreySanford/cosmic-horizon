/**
 * Job Orchestration Models
 * Represents AI-assisted reprocessing jobs for autonomous agents
 */

export interface Agent {
  id: string;
  name: string;
  description: string;
  version: string;
  requiredResources: {
    cpu: number;
    memory: number; // GB
    gpu?: number;
  };
}

export interface JobParameters {
  [key: string]: string | number | boolean | string[];
}

export interface Job {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  parameters: JobParameters;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  progress: number; // 0-100
  estimatedTimeRemaining?: number; // seconds
  outputPath?: string;
  errorMessage?: string;
  logs?: string[];
  /** history of progress updates used for charting */
  progressHistory?: { time: number; progress: number }[];
}

export interface JobSubmissionRequest {
  name: string;
  agentId: string;
  parameters: JobParameters;
  resourceAllocation?: {
    cpuCores?: number;
    memoryGb?: number;
    gpuCount?: number;
  };
}

export interface JobSubmissionResponse {
  jobId: string;
  status: string;
  message: string;
}

export type JobStatus = Job['status'];
