import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateUserDto, UpdateUserDto, CreatePostDto, UpdatePostDto } from './dto';
import { User, Post, AuditAction, AuditEntityType } from './entities';
import { UserRepository, PostRepository, AuditLogRepository } from './repositories';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly userRepository: UserRepository,
    private readonly postRepository: PostRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  getData(): { message: string } {
    return { message: 'VLASS Portal API' };
  }

  async getHealthStatus() {
    try {
      const isConnected = this.dataSource.isInitialized;
      const dbStatus = isConnected
        ? 'connected'
        : 'disconnected';

      this.logger.log(`Database status: ${dbStatus}`);

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        environment: process.env.NODE_ENV || 'development',
      };
    } catch (error) {
      this.logger.error('Health check failed', error instanceof Error ? error.message : error);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // User endpoints
  async getAllUsers(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async getUserByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new NotFoundException(`User with username ${username} not found`);
    }
    return user;
  }

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.userRepository.findByUsername(createUserDto.username);
    if (existingUser) {
      throw new BadRequestException(`Username ${createUserDto.username} already exists`);
    }
    const user = await this.userRepository.create(createUserDto);
    await this.auditLogRepository.createAuditLog({
      user_id: user.id,
      action: AuditAction.CREATE,
      entity_type: AuditEntityType.USER,
      entity_id: user.id,
      changes: { after: { username: user.username, email: user.email } },
    });
    return user;
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    const updatedUser = await this.userRepository.update(id, updateUserDto);
    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.auditLogRepository.createAuditLog({
      user_id: id,
      action: AuditAction.UPDATE,
      entity_type: AuditEntityType.USER,
      entity_id: id,
      changes: {
        before: { username: user.username, email: user.email },
        after: { username: updatedUser.username, email: updatedUser.email },
      },
    });
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    const deleted = await this.userRepository.softDelete(id);
    if (deleted) {
      await this.auditLogRepository.createAuditLog({
        user_id: id,
        action: AuditAction.DELETE,
        entity_type: AuditEntityType.USER,
        entity_id: id,
        changes: { before: { username: user.username, email: user.email } },
      });
    }
    return deleted;
  }

  // Post endpoints
  async getAllPosts(): Promise<Post[]> {
    return this.postRepository.findAll();
  }

  async getPublishedPosts(): Promise<Post[]> {
    return this.postRepository.findPublished();
  }

  async getPostById(id: string): Promise<Post> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    return post;
  }

  async getPostsByUser(userId: string): Promise<Post[]> {
    // Verify user exists
    await this.getUserById(userId);
    return this.postRepository.findByUser(userId);
  }

  async createPost(createPostDto: CreatePostDto): Promise<Post> {
    // Verify user exists
    await this.getUserById(createPostDto.user_id);
    const post = await this.postRepository.create(createPostDto);
    await this.auditLogRepository.createAuditLog({
      user_id: createPostDto.user_id,
      action: AuditAction.CREATE,
      entity_type: AuditEntityType.POST,
      entity_id: post.id,
      changes: { after: { title: post.title, status: post.status } },
    });
    return post;
  }

  async updatePost(id: string, updatePostDto: UpdatePostDto): Promise<Post> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    const updatedPost = await this.postRepository.update(id, updatePostDto);
    if (!updatedPost) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    await this.auditLogRepository.createAuditLog({
      user_id: post.user_id,
      action: AuditAction.UPDATE,
      entity_type: AuditEntityType.POST,
      entity_id: id,
      changes: {
        before: { title: post.title, status: post.status },
        after: { title: updatedPost.title, status: updatedPost.status },
      },
    });
    return updatedPost;
  }

  async publishPost(id: string): Promise<Post> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    const publishedPost = await this.postRepository.publish(id);
    if (!publishedPost) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    await this.auditLogRepository.createAuditLog({
      user_id: post.user_id,
      action: AuditAction.PUBLISH,
      entity_type: AuditEntityType.POST,
      entity_id: id,
      changes: {
        before: { status: post.status },
        after: { status: publishedPost.status },
      },
    });
    return publishedPost;
  }

  async unpublishPost(id: string): Promise<Post> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    const unpublishedPost = await this.postRepository.unpublish(id);
    if (!unpublishedPost) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    await this.auditLogRepository.createAuditLog({
      user_id: post.user_id,
      action: AuditAction.UNPUBLISH,
      entity_type: AuditEntityType.POST,
      entity_id: id,
      changes: {
        before: { status: post.status },
        after: { status: unpublishedPost.status },
      },
    });
    return unpublishedPost;
  }

  async deletePost(id: string): Promise<boolean> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    const deleted = await this.postRepository.softDelete(id);
    if (deleted) {
      await this.auditLogRepository.createAuditLog({
        user_id: post.user_id,
        action: AuditAction.DELETE,
        entity_type: AuditEntityType.POST,
        entity_id: id,
        changes: { before: { title: post.title, status: post.status } },
      });
    }
    return deleted;
  }
}
