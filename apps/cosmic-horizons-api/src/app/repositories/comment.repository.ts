import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Comment } from '../entities/comment.entity';

@Injectable()
export class CommentRepository {
  constructor(
    @InjectRepository(Comment)
    private readonly repo: Repository<Comment>,
  ) {}

  async findByPost(postId: string): Promise<Comment[]> {
    // We fetch all non-deleted, non-hidden comments for a post.
    return this.repo.find({
      where: { post_id: postId, deleted_at: IsNull(), hidden_at: IsNull() },
      relations: ['user'],
      order: { created_at: 'ASC' },
    });
  }

  async findById(id: string): Promise<Comment | null> {
    return this.repo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: ['user', 'parent'],
    });
  }

  async create(comment: Partial<Comment>): Promise<Comment> {
    const entity = this.repo.create(comment);
    return this.repo.save(entity);
  }

  async update(id: string, content: string): Promise<Comment | null> {
    await this.repo.update(
      { id, deleted_at: IsNull() },
      { content, updated_at: new Date() },
    );
    return this.findById(id);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repo.update(
      { id, deleted_at: IsNull() },
      { deleted_at: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }

  async hide(id: string): Promise<Comment | null> {
    await this.repo.update(
      { id, deleted_at: IsNull() },
      { hidden_at: new Date() },
    );
    return this.findById(id);
  }

  async unhide(id: string): Promise<Comment | null> {
    await this.repo.update({ id, deleted_at: IsNull() }, { hidden_at: null });
    return this.findById(id);
  }
}
