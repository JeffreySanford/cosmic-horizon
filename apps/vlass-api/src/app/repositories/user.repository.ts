import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.repo.find({
      where: { deleted_at: IsNull() },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id, deleted_at: IsNull() });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.repo.findOneBy({ username, deleted_at: IsNull() });
  }

  async findByGithubId(githubId: number): Promise<User | null> {
    return this.repo.findOneBy({ github_id: githubId, deleted_at: IsNull() });
  }

  async create(user: Partial<User>): Promise<User> {
    const entity = this.repo.create(user);
    return this.repo.save(entity);
  }

  async update(id: string, user: Omit<Partial<User>, 'posts' | 'revisions' | 'comments' | 'auditLogs'>): Promise<User | null> {
    await this.repo.update({ id, deleted_at: IsNull() }, user);
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
