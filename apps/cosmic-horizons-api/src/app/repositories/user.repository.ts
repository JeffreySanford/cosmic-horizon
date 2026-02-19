import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, FindOneOptions } from 'typeorm';
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

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email, deleted_at: IsNull() });
  }

  async findByEmailAndPassword(
    email: string,
    password: string,
  ): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .andWhere('user.deleted_at IS NULL')
      .andWhere('user.password_hash IS NOT NULL')
      .andWhere('user.password_hash = crypt(:password, user.password_hash)', {
        password,
      })
      .getOne();
  }

  async findByGithubId(githubId: number): Promise<User | null> {
    return this.repo.findOneBy({ github_id: githubId, deleted_at: IsNull() });
  }

  async findByGitHubId(githubId: number): Promise<User | null> {
    return this.findByGithubId(githubId);
  }

  async findOne(options: FindOneOptions<User>): Promise<User | null> {
    return this.repo.findOne(options);
  }

  async create(user: Partial<User>): Promise<User> {
    const entity = this.repo.create(user);
    return this.repo.save(entity);
  }

  async createWithPassword(params: {
    username: string;
    display_name: string;
    email: string;
    password: string;
  }): Promise<User> {
    const rows = (await this.repo.query(
      `
        INSERT INTO users (username, display_name, email, password_hash)
        VALUES ($1, $2, $3, crypt($4, gen_salt('bf')))
        RETURNING id
      `,
      [params.username, params.display_name, params.email, params.password],
    )) as Array<{ id: string }>;

    const created = rows[0] ? await this.findById(rows[0].id) : null;
    if (!created) {
      throw new Error('Failed to create user record');
    }

    return created;
  }

  async save(user: User): Promise<User> {
    return this.repo.save(user);
  }

  async update(
    id: string,
    user: Omit<Partial<User>, 'posts' | 'revisions' | 'comments' | 'auditLogs'>,
  ): Promise<User | null> {
    await this.repo.update({ id, deleted_at: IsNull() }, user);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repo.update(
      { id, deleted_at: IsNull() },
      { deleted_at: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }

  async hardDelete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
