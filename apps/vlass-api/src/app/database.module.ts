import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './database.config';
import {
  User,
  Post,
  Revision,
  Comment,
  Snapshot,
  ViewerState,
  ViewerSnapshot,
  AuditLog,
  VlassTileCache,
} from './entities';
import { UserRepository, PostRepository, AuditLogRepository } from './repositories';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig()),
    TypeOrmModule.forFeature([
      User,
      Post,
      Revision,
      Comment,
      Snapshot,
      ViewerState,
      ViewerSnapshot,
      AuditLog,
      VlassTileCache,
    ]),
  ],
  providers: [UserRepository, PostRepository, AuditLogRepository],
  exports: [TypeOrmModule, UserRepository, PostRepository, AuditLogRepository],
})
export class DatabaseModule {}
