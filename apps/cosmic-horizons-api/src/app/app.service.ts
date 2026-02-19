import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateUserDto,
  UpdateUserDto,
  CreatePostDto,
  UpdatePostDto,
} from './dto';
import { User, Post, AuditAction, AuditEntityType } from './entities';
import {
  UserRepository,
  PostRepository,
  AuditLogRepository,
  RevisionRepository,
} from './repositories';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly userRepository: UserRepository,
    private readonly postRepository: PostRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly revisionRepository: RevisionRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensurePostModerationColumns();
  }

  getData(): { message: string } {
    return { message: 'Cosmic Horizon API' };
  }

  async getHealthStatus() {
    try {
      const isConnected = this.dataSource.isInitialized;
      const dbStatus = isConnected ? 'connected' : 'disconnected';

      this.logger.log(`Database status: ${dbStatus}`);

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        environment: process.env.NODE_ENV || 'development',
      };
    } catch (error) {
      this.logger.error(
        'Health check failed',
        error instanceof Error ? error.message : error,
      );
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
    const existingUser = await this.userRepository.findByUsername(
      createUserDto.username,
    );
    if (existingUser) {
      throw new BadRequestException(
        `Username ${createUserDto.username} already exists`,
      );
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

  async updatePost(
    id: string,
    actorUserId: string,
    updatePostDto: UpdatePostDto,
  ): Promise<Post> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    this.assertCanEditPost(post, actorUserId);

    const updatedPost = await this.postRepository.update(id, updatePostDto);
    if (!updatedPost) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    await this.createRevisionSnapshot(
      updatedPost,
      actorUserId,
      'Post content updated',
    );
    await this.auditLogRepository.createAuditLog({
      user_id: actorUserId,
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

  async publishPost(id: string, actorUserId: string): Promise<Post> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    this.assertCanEditPost(post, actorUserId);

    const publishedPost = await this.postRepository.publish(id);
    if (!publishedPost) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    await this.createRevisionSnapshot(
      publishedPost,
      actorUserId,
      'Published post revision',
    );
    await this.auditLogRepository.createAuditLog({
      user_id: actorUserId,
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

  async unpublishPost(id: string, actorUserId: string): Promise<Post> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    this.assertCanEditPost(post, actorUserId);

    const unpublishedPost = await this.postRepository.unpublish(id);
    if (!unpublishedPost) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    await this.auditLogRepository.createAuditLog({
      user_id: actorUserId,
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

  async deletePost(id: string, actorUserId: string): Promise<boolean> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    this.assertCanEditPost(post, actorUserId);

    const deleted = await this.postRepository.softDelete(id);
    if (deleted) {
      await this.auditLogRepository.createAuditLog({
        user_id: actorUserId,
        action: AuditAction.DELETE,
        entity_type: AuditEntityType.POST,
        entity_id: id,
        changes: { before: { title: post.title, status: post.status } },
      });
    }
    return deleted;
  }

  async hidePost(id: string, actorUserId: string): Promise<Post> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    await this.assertCanModeratePost(post, actorUserId);
    const hiddenPost = await this.postRepository.hide(id);
    if (!hiddenPost) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    await this.auditLogRepository.createAuditLog({
      user_id: actorUserId,
      action: AuditAction.HIDE,
      entity_type: AuditEntityType.POST,
      entity_id: id,
      changes: {
        before: { hidden_at: post.hidden_at },
        after: { hidden_at: hiddenPost.hidden_at },
      },
    });

    return hiddenPost;
  }

  async unhidePost(id: string, actorUserId: string): Promise<Post> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    await this.assertCanModeratePost(post, actorUserId);
    const unhiddenPost = await this.postRepository.unhide(id);
    if (!unhiddenPost) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    await this.auditLogRepository.createAuditLog({
      user_id: actorUserId,
      action: AuditAction.UNHIDE,
      entity_type: AuditEntityType.POST,
      entity_id: id,
      changes: {
        before: { hidden_at: post.hidden_at },
        after: { hidden_at: unhiddenPost.hidden_at },
      },
    });

    return unhiddenPost;
  }

  async lockPost(id: string, actorUserId: string): Promise<Post> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    await this.assertCanModeratePost(post, actorUserId);
    const lockedPost = await this.postRepository.lock(id);
    if (!lockedPost) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    await this.auditLogRepository.createAuditLog({
      user_id: actorUserId,
      action: AuditAction.LOCK,
      entity_type: AuditEntityType.POST,
      entity_id: id,
      changes: {
        before: { locked_at: post.locked_at },
        after: { locked_at: lockedPost.locked_at },
      },
    });

    return lockedPost;
  }

  async unlockPost(id: string, actorUserId: string): Promise<Post> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    await this.assertCanModeratePost(post, actorUserId);
    const unlockedPost = await this.postRepository.unlock(id);
    if (!unlockedPost) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    await this.auditLogRepository.createAuditLog({
      user_id: actorUserId,
      action: AuditAction.UNLOCK,
      entity_type: AuditEntityType.POST,
      entity_id: id,
      changes: {
        before: { locked_at: post.locked_at },
        after: { locked_at: unlockedPost.locked_at },
      },
    });

    return unlockedPost;
  }

  private assertCanEditPost(post: Post, actorUserId: string): void {
    if (post.user_id !== actorUserId) {
      throw new ForbiddenException('Only the post owner can modify this post');
    }

    if (post.locked_at) {
      throw new ForbiddenException('Post is locked and cannot be modified');
    }
  }

  private async assertCanModeratePost(
    post: Post,
    actorUserId: string,
  ): Promise<void> {
    const actor = await this.userRepository.findById(actorUserId);
    if (!actor) {
      throw new ForbiddenException('Acting user was not found');
    }

    const isOwner = post.user_id === actorUserId;
    const isModerator = actor.role === 'moderator' || actor.role === 'admin';
    if (!isOwner && !isModerator) {
      throw new ForbiddenException(
        'Only moderators, admins, or post owners can moderate this post',
      );
    }
  }

  private async createRevisionSnapshot(
    post: Post,
    actorUserId: string,
    changeSummary: string,
  ): Promise<void> {
    await this.revisionRepository.create({
      post_id: post.id,
      user_id: actorUserId,
      title: post.title,
      description: post.description,
      content: post.content,
      change_summary: changeSummary,
    });
  }

  private async ensurePostModerationColumns(): Promise<void> {
    await this.dataSource.query(`
      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP NULL;
    `);

    await this.dataSource.query(`
      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP NULL;
    `);
  }
}
