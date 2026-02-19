/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test Data Builders with Strong Type Safety
 * Ensures all test mocks have complete entity structures
 */

import { PostStatus } from '../entities/post.entity';

/**
 * Builder for Comment entities with full type safety
 */
export class CommentBuilder {
  private comment = {
    id: 'comment-1',
    content: 'Test comment',
    user_id: 'user-1',
    post_id: 'post-1',
    parent_id: null as string | null,
    parent: null as any, // Will be fully typed
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null as Date | null,
    hidden: false,
    hidden_at: null as Date | null,
    post: null as any, // Will be fully typed
    user: null as any, // Will be fully typed
    replies: [] as any[], // Will be fully typed
  };

  withId(id: string) {
    this.comment.id = id;
    return this;
  }

  withContent(content: string) {
    this.comment.content = content;
    return this;
  }

  withUserId(userId: string) {
    this.comment.user_id = userId;
    return this;
  }

  withPostId(postId: string) {
    this.comment.post_id = postId;
    return this;
  }

  withParentId(parentId: string | null) {
    this.comment.parent_id = parentId;
    return this;
  }

  withHidden(hidden: boolean, hiddenAt?: Date) {
    this.comment.hidden = hidden;
    this.comment.hidden_at = hiddenAt || (hidden ? new Date() : null);
    return this;
  }

  withDeleted(deleted: boolean, deletedAt?: Date) {
    this.comment.deleted_at = deleted ? deletedAt || new Date() : null;
    return this;
  }

  withParent(parent: any) {
    this.comment.parent = parent;
    return this;
  }

  withPost(post: any) {
    this.comment.post = post;
    return this;
  }

  withUser(user: any) {
    this.comment.user = user;
    return this;
  }

  withReplies(replies: any[]) {
    this.comment.replies = replies;
    return this;
  }

  build(): any {
    // Ensure user is set if not provided
    if (!this.comment.user) {
      this.comment.user = {
        id: this.comment.user_id,
        email: `user${this.comment.user_id}@example.com`,
        name: 'Test User',
      };
    }
    // Ensure post is set if not provided
    if (!this.comment.post) {
      this.comment.post = {
        id: this.comment.post_id,
        title: 'Test Post',
        status: PostStatus.PUBLISHED,
        user_id: 'post-owner',
      };
    }
    return { ...this.comment };
  }
}

/**
 * Builder for Post entities with full type safety
 */
export class PostBuilder {
  private post = {
    id: 'post-1',
    title: 'Test Post',
    description: 'Test description',
    content: 'Test content',
    status: PostStatus.PUBLISHED,
    user_id: 'user-1',
    locked_at: null as Date | null,
    published_at: new Date(),
    hidden_at: null as Date | null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null as Date | null,
  };

  withId(id: string) {
    this.post.id = id;
    return this;
  }

  withTitle(title: string) {
    this.post.title = title;
    return this;
  }

  withStatus(status: PostStatus) {
    this.post.status = status;
    return this;
  }

  withUserId(userId: string) {
    this.post.user_id = userId;
    return this;
  }

  withContent(content: string) {
    this.post.content = content;
    return this;
  }

  withDescription(description: string) {
    this.post.description = description;
    return this;
  }

  withCreatedAt(createdAt: Date) {
    this.post.created_at = createdAt;
    return this;
  }

  withLocked(locked: boolean, lockedAt?: Date) {
    this.post.locked_at = locked ? lockedAt || new Date() : null;
    return this;
  }

  withHidden(hidden: boolean, hiddenAt?: Date) {
    this.post.hidden_at = hidden ? hiddenAt || new Date() : null;
    return this;
  }

  withDeleted(deleted: boolean, deletedAt?: Date) {
    this.post.deleted_at = deleted ? deletedAt || new Date() : null;
    return this;
  }

  build(): any {
    return { ...this.post };
  }
}

/**
 * Builder for CommentReport entities with full type safety
 */
export class CommentReportBuilder {
  private report = {
    id: 'report-1',
    comment_id: 'comment-1',
    user_id: 'user-2',
    reason: 'Spam',
    description: 'This is spam',
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date(),
    comment: null as any,
    user: null as any,
  };

  withId(id: string) {
    this.report.id = id;
    return this;
  }

  withCommentId(commentId: string) {
    this.report.comment_id = commentId;
    return this;
  }

  withUserId(userId: string) {
    this.report.user_id = userId;
    return this;
  }

  withReason(reason: string) {
    this.report.reason = reason;
    return this;
  }

  withStatus(status: string) {
    this.report.status = status;
    return this;
  }

  withComment(comment: any) {
    this.report.comment = comment;
    return this;
  }

  withUser(user: any) {
    this.report.user = user;
    return this;
  }

  build(): any {
    // Ensure comment is set if not provided
    if (!this.report.comment) {
      this.report.comment = new CommentBuilder()
        .withId(this.report.comment_id)
        .build();
    }
    // Ensure user is set if not provided
    if (!this.report.user) {
      this.report.user = {
        id: this.report.user_id,
        email: `user${this.report.user_id}@example.com`,
        name: 'Test User',
      };
    }
    return { ...this.report };
  }
}

/**
 * Builder for LogEntry entities with full type safety
 */
export class LogEntryBuilder {
  private log = {
    id: 'log-1',
    at: new Date(),
    type: 'ACTION',
    severity: 'INFO',
    message: 'Test log',
    context: 'test',
    meta: {} as Record<string, any>,
  };

  withId(id: string) {
    this.log.id = id;
    return this;
  }

  withAt(at: Date) {
    this.log.at = at;
    return this;
  }

  withType(type: string) {
    this.log.type = type;
    return this;
  }

  withSeverity(severity: string) {
    this.log.severity = severity;
    return this;
  }

  withMessage(message: string) {
    this.log.message = message;
    return this;
  }

  withContext(context: string) {
    this.log.context = context;
    return this;
  }

  withMeta(meta: Record<string, any>) {
    this.log.meta = meta;
    return this;
  }

  build(): any {
    return { ...this.log };
  }
}

/**
 * Builder for User entities with full type safety
 */
export class UserBuilder {
  private user = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    name: 'Test User',
    password: null as string | null,
    password_hash: null as string | null,
    github_id: null as string | null,
    github_username: null as string | null,
    avatar_url: null as string | null,
    bio: null as string | null,
    role: 'USER',
    status: 'active',
    last_login_at: null as Date | null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  withId(id: string) {
    this.user.id = id;
    return this;
  }

  withEmail(email: string) {
    this.user.email = email;
    return this;
  }

  withUsername(username: string) {
    this.user.username = username;
    return this;
  }

  withName(name: string) {
    this.user.name = name;
    return this;
  }

  withPassword(password: string, hash?: string) {
    this.user.password = password;
    this.user.password_hash = hash || `hashed_${password}`;
    return this;
  }

  withGithubId(githubId: string, username?: string) {
    this.user.github_id = githubId;
    this.user.github_username = username || `github_${githubId}`;
    return this;
  }

  withAvatarUrl(avatarUrl: string) {
    this.user.avatar_url = avatarUrl;
    return this;
  }

  withBio(bio: string) {
    this.user.bio = bio;
    return this;
  }

  withRole(role: string) {
    this.user.role = role;
    return this;
  }

  withStatus(status: string) {
    this.user.status = status;
    return this;
  }

  withLastLogin(lastLoginAt?: Date) {
    this.user.last_login_at = lastLoginAt || new Date();
    return this;
  }

  withCreatedAt(createdAt: Date) {
    this.user.created_at = createdAt;
    return this;
  }

  build(): any {
    return { ...this.user };
  }
}

/**
 * Builder for Revision entities with full type safety
 */
export class RevisionBuilder {
  private revision = {
    id: 'revision-1',
    post_id: 'post-1',
    user_id: 'user-1',
    title: 'Test Post',
    content: 'Test content',
    version: 1,
    created_at: new Date(),
    post: null as any,
    user: null as any,
  };

  withId(id: string) {
    this.revision.id = id;
    return this;
  }

  withPostId(postId: string) {
    this.revision.post_id = postId;
    return this;
  }

  withUserId(userId: string) {
    this.revision.user_id = userId;
    return this;
  }

  withTitle(title: string) {
    this.revision.title = title;
    return this;
  }

  withContent(content: string) {
    this.revision.content = content;
    return this;
  }

  withVersion(version: number) {
    this.revision.version = version;
    return this;
  }

  withCreatedAt(createdAt: Date) {
    this.revision.created_at = createdAt;
    return this;
  }

  withPost(post: any) {
    this.revision.post = post;
    return this;
  }

  withUser(user: any) {
    this.revision.user = user;
    return this;
  }

  build(): any {
    if (!this.revision.post) {
      this.revision.post = new PostBuilder()
        .withId(this.revision.post_id)
        .build();
    }
    if (!this.revision.user) {
      this.revision.user = new UserBuilder()
        .withId(this.revision.user_id)
        .build();
    }
    return { ...this.revision };
  }
}

/**
 * Convenience functions for common test scenarios
 */
export const TestDataFactory = {
  createComment: (overrides?: Partial<any>) =>
    Object.assign(new CommentBuilder().build(), overrides),

  createPost: (overrides?: Partial<any>) =>
    Object.assign(new PostBuilder().build(), overrides),

  createCommentReport: (overrides?: Partial<any>) =>
    Object.assign(new CommentReportBuilder().build(), overrides),

  createLogEntry: (overrides?: Partial<any>) =>
    Object.assign(new LogEntryBuilder().build(), overrides),

  createUser: (overrides?: Partial<any>) =>
    Object.assign(new UserBuilder().build(), overrides),

  createRevision: (overrides?: Partial<any>) =>
    Object.assign(new RevisionBuilder().build(), overrides),
};
