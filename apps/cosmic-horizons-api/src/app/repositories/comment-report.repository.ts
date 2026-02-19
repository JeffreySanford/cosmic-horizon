import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommentReport } from '../entities/comment-report.entity';

@Injectable()
export class CommentReportRepository {
  constructor(
    @InjectRepository(CommentReport)
    private readonly repo: Repository<CommentReport>,
  ) {}

  async findAll(): Promise<CommentReport[]> {
    return this.repo.find({
      relations: ['comment', 'user', 'resolver'],
      order: { created_at: 'DESC' },
    });
  }

  async findPending(): Promise<CommentReport[]> {
    return this.repo.find({
      where: { status: 'pending' },
      relations: ['comment', 'user'],
      order: { created_at: 'ASC' },
    });
  }

  async findById(id: string): Promise<CommentReport | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['comment', 'user', 'resolver'],
    });
  }

  async create(report: Partial<CommentReport>): Promise<CommentReport> {
    const entity = this.repo.create(report);
    return this.repo.save(entity);
  }

  async resolve(
    id: string,
    resolverId: string,
    status: 'reviewed' | 'dismissed',
  ): Promise<CommentReport | null> {
    await this.repo.update(
      { id },
      {
        status,
        resolved_at: new Date(),
        resolved_by: resolverId,
      },
    );
    return this.findById(id);
  }
}
