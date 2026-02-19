import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { randomUUID } from 'crypto';
import { Job, JobStatus, AgentType } from '../entities/job.entity';

export interface CreateJobParams {
  user_id: string;
  agent: AgentType;
  dataset_id: string;
  params: Record<string, string | number | boolean | undefined>;
  gpu_count?: number;
}

@Injectable()
export class JobRepository {
  constructor(
    @InjectRepository(Job)
    private readonly repository: Repository<Job>,
  ) {}

  async create(data: CreateJobParams): Promise<Job> {
    const job = this.repository.create({
      id: randomUUID(),
      ...data,
      status: 'QUEUED' as JobStatus,
      progress: 0,
    });
    return this.repository.save(job);
  }

  async findById(id: string): Promise<Job | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  async findByTaccJobId(taccJobId: string): Promise<Job | null> {
    return this.repository.findOne({
      where: { tacc_job_id: taccJobId },
    });
  }

  async findByUser(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<[Job[], number]> {
    return this.repository.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findByStatus(status: JobStatus): Promise<Job[]> {
    return this.repository.find({
      where: { status },
      order: { created_at: 'ASC' },
    });
  }

  async updateStatus(
    id: string,
    status: JobStatus,
    progress?: number,
  ): Promise<void> {
    await this.repository.update(
      { id },
      {
        status,
        ...(progress !== undefined && { progress }),
        ...(status === 'COMPLETED' && { completed_at: new Date() }),
        ...(status === 'FAILED' && { completed_at: new Date() }),
      },
    );
  }

  async updateProgress(id: string, progress: number): Promise<void> {
    await this.repository.update({ id }, { progress });
  }

  async updateResult(id: string, result: Job['result']): Promise<void> {
    await this.repository.update({ id }, { result });
  }

  async search(
    filters: {
      user_id?: string;
      agent?: AgentType;
      status?: JobStatus;
      dataset_id?: string;
      from_date?: Date;
      to_date?: Date;
    },
    limit = 50,
    offset = 0,
  ): Promise<[Job[], number]> {
    const where: FindOptionsWhere<Job> = {};

    if (filters.user_id) where.user_id = filters.user_id;
    if (filters.agent) where.agent = filters.agent;
    if (filters.status) where.status = filters.status;
    if (filters.dataset_id) where.dataset_id = filters.dataset_id;

    return this.repository.findAndCount({
      where,
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
