import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CommentRepository } from '../repositories/comment.repository';
import { PostRepository } from '../repositories/post.repository';
import { CommentReportRepository } from '../repositories/comment-report.repository';
import { CreateCommentDto, UpdateCommentDto, ReportCommentDto } from '../dto';
import { Comment } from '../entities/comment.entity';
import { CommentReport } from '../entities/comment-report.entity';
import { PostStatus } from '../entities/post.entity';
import { AuditAction, AuditEntityType } from '../entities/audit-log.entity';
import { AuditLogRepository } from '../repositories/audit-log.repository';

@Injectable()
export class CommentsService {
  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly postRepository: PostRepository,
    private readonly commentReportRepository: CommentReportRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async getCommentsByPost(postId: string): Promise<Comment[]> {
    const post = await this.postRepository.findById(postId);
    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    // Only allow comments for published posts unless requester is the owner (handled in controller if needed)
    // For now, simplicity: if it's there, fetch it.
    return this.commentRepository.findByPost(postId);
  }

  async createComment(userId: string, dto: CreateCommentDto): Promise<Comment> {
    const post = await this.postRepository.findById(dto.post_id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${dto.post_id} not found`);
    }

    if (post.status !== PostStatus.PUBLISHED && post.user_id !== userId) {
      throw new ForbiddenException(
        'Cannot comment on unpublished posts of other users',
      );
    }

    if (post.locked_at) {
      throw new ForbiddenException('Post is locked, no new comments allowed');
    }

    if (dto.parent_id) {
      const parent = await this.commentRepository.findById(dto.parent_id);
      if (!parent) {
        throw new NotFoundException(
          `Parent comment with ID ${dto.parent_id} not found`,
        );
      }
      if (parent.post_id !== dto.post_id) {
        throw new ForbiddenException(
          'Parent comment belongs to a different post',
        );
      }
    }

    const commentData: Partial<Comment> = {
      user_id: userId,
      post_id: dto.post_id,
      content: dto.content,
      parent_id: dto.parent_id ?? null,
      parent: dto.parent_id ? ({ id: dto.parent_id } as Comment) : null,
    };

    const comment = await this.commentRepository.create(commentData);

    await this.auditLogRepository.createAuditLog({
      user_id: userId,
      action: AuditAction.CREATE,
      entity_type: AuditEntityType.COMMENT,
      entity_id: comment.id,
      changes: { after: { post_id: dto.post_id, parent_id: dto.parent_id } },
    });

    return comment;
  }

  async updateComment(
    id: string,
    userId: string,
    dto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.commentRepository.findById(id);
    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    if (comment.user_id !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const updated = await this.commentRepository.update(id, dto.content);
    if (!updated) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    await this.auditLogRepository.createAuditLog({
      user_id: userId,
      action: AuditAction.UPDATE,
      entity_type: AuditEntityType.COMMENT,
      entity_id: id,
      changes: {
        before: { content: comment.content },
        after: { content: dto.content },
      },
    });

    return updated;
  }

  async deleteComment(id: string, userId: string): Promise<boolean> {
    const comment = await this.commentRepository.findById(id);
    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    // Allow owner or post owner to delete comments
    const post = await this.postRepository.findById(comment.post_id);
    const isPostOwner = post?.user_id === userId;

    if (comment.user_id !== userId && !isPostOwner) {
      throw new ForbiddenException(
        'You do not have permission to delete this comment',
      );
    }

    const deleted = await this.commentRepository.softDelete(id);
    if (deleted) {
      await this.auditLogRepository.createAuditLog({
        user_id: userId,
        action: AuditAction.DELETE,
        entity_type: AuditEntityType.COMMENT,
        entity_id: id,
        changes: { before: { content: comment.content } },
      });
    }
    return deleted;
  }

  async reportComment(
    commentId: string,
    userId: string,
    dto: ReportCommentDto,
  ): Promise<CommentReport> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      throw new NotFoundException(`Comment with ID ${commentId} not found`);
    }

    return this.commentReportRepository.create({
      comment_id: commentId,
      user_id: userId,
      reason: dto.reason,
      description: dto.description,
    });
  }

  async hideComment(id: string, userId: string): Promise<Comment | null> {
    const comment = await this.commentRepository.findById(id);
    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    const post = await this.postRepository.findById(comment.post_id);
    if (post?.user_id !== userId) {
      throw new ForbiddenException('Only the post owner can hide comments');
    }

    return this.commentRepository.hide(id);
  }

  async unhideComment(id: string, userId: string): Promise<Comment | null> {
    const comment = await this.commentRepository.findById(id);
    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    const post = await this.postRepository.findById(comment.post_id);
    if (post?.user_id !== userId) {
      throw new ForbiddenException('Only the post owner can unhide comments');
    }

    return this.commentRepository.unhide(id);
  }

  async getAllReports(): Promise<CommentReport[]> {
    return this.commentReportRepository.findAll();
  }

  async resolveReport(
    id: string,
    userId: string,
    status: 'reviewed' | 'dismissed',
  ): Promise<CommentReport | null> {
    return this.commentReportRepository.resolve(id, userId, status);
  }
}
