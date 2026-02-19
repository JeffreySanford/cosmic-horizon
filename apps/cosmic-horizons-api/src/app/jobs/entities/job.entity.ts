import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type JobStatus =
  | 'QUEUED'
  | 'QUEUING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';
export type AgentType =
  | 'AlphaCal'
  | 'ImageReconstruction'
  | 'AnomalyDetection'
  | string;

@Entity('jobs')
@Index(['user_id', 'created_at'])
@Index(['status', 'created_at'])
@Index(['tacc_job_id'])
export class Job {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('varchar')
  agent!: AgentType;

  @Column('uuid')
  dataset_id!: string;

  @Column('varchar', { nullable: true })
  tacc_job_id?: string;

  @Column('varchar')
  status!: JobStatus;

  @Column('float', { default: 0 })
  progress!: number;

  @Column('jsonb', { default: {} })
  params!: Record<string, string | number | boolean | undefined>;

  @Column('jsonb', { nullable: true })
  result?: {
    output_url?: string;
    metrics?: Record<string, number | string>;
    error_message?: string;
  };

  @Column('text', { nullable: true })
  notes?: string;

  @Column('int', { nullable: true })
  estimated_runtime_minutes?: number;

  @Column('int', { nullable: true })
  gpu_count?: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;

  @Column('timestamp', { nullable: true })
  completed_at?: Date;
}
