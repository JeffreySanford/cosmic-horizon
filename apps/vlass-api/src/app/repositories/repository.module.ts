import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  Comment,
  CommentReport,
  Post,
  Revision,
  User,
} from '../entities';
import { AuditLogRepository } from './audit-log.repository';
import { CommentReportRepository } from './comment-report.repository';
import { CommentRepository } from './comment.repository';
import { PostRepository } from './post.repository';
import { RevisionRepository } from './revision.repository';
import { UserRepository } from './user.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Post,
      Comment,
      CommentReport,
      AuditLog,
      Revision,
    ]),
  ],
  providers: [
    UserRepository,
    PostRepository,
    CommentRepository,
    CommentReportRepository,
    AuditLogRepository,
    RevisionRepository,
  ],
  exports: [
    UserRepository,
    PostRepository,
    CommentRepository,
    CommentReportRepository,
    AuditLogRepository,
    RevisionRepository,
  ],
})
export class RepositoryModule {}
