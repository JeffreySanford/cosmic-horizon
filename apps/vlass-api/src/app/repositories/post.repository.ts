import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Post, PostStatus } from '../entities/post.entity';

@Injectable()
export class PostRepository {
  constructor(
    @InjectRepository(Post)
    private readonly repo: Repository<Post>,
  ) {}

  async findAll(): Promise<Post[]> {
    return this.repo.find({
      where: { deleted_at: IsNull() },
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: string): Promise<Post | null> {
    return this.repo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: ['user', 'revisions', 'comments', 'snapshots'],
    });
  }

  async findByUser(userId: string): Promise<Post[]> {
    return this.repo.find({
      where: { user_id: userId, deleted_at: IsNull() },
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  }

  async findPublished(): Promise<Post[]> {
    return this.repo.find({
      where: { status: PostStatus.PUBLISHED, deleted_at: IsNull() },
      relations: ['user'],
      order: { published_at: 'DESC' },
    });
  }

  async create(post: Partial<Post>): Promise<Post> {
    const entity = this.repo.create(post);
    return this.repo.save(entity);
  }

  async update(id: string, post: Omit<Partial<Post>, 'user' | 'revisions' | 'comments' | 'snapshots'>): Promise<Post | null> {
    await this.repo.update({ id, deleted_at: IsNull() }, post);
    return this.findById(id);
  }

  async publish(id: string): Promise<Post | null> {
    const now = new Date();
    await this.repo.update(
      { id, deleted_at: IsNull() },
      { status: PostStatus.PUBLISHED, published_at: now, updated_at: now }
    );
    return this.findById(id);
  }

  async unpublish(id: string): Promise<Post | null> {
    await this.repo.update(
      { id, deleted_at: IsNull() },
      { status: PostStatus.DRAFT, published_at: null }
    );
    return this.findById(id);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repo.update(
      { id, deleted_at: IsNull() },
      { deleted_at: new Date() }
    );
    return (result.affected ?? 0) > 0;
  }

  async hardDelete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
