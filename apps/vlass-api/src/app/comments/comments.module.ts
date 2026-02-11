import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { Comment } from '../entities/comment.entity';
import { Post } from '../entities/post.entity';
import { CommentReport } from '../entities/comment-report.entity';
import { CommentRepository } from '../repositories/comment.repository';
import { PostRepository } from '../repositories/post.repository';
import { CommentReportRepository } from '../repositories/comment-report.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuditLog } from '../entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Post, CommentReport, AuditLog])],
  controllers: [CommentsController],
  providers: [
    CommentsService,
    CommentRepository,
    PostRepository,
    CommentReportRepository,
    AuditLogRepository,
  ],
})
export class CommentsModule {}
