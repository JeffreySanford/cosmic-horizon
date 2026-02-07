import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './database.config';
import {
  User,
  Post,
  Revision,
  Comment,
  Snapshot,
  AuditLog,
  VlassTileCache,
} from './entities';
import { UserRepository, PostRepository } from './repositories';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig()),
    TypeOrmModule.forFeature([
      User,
      Post,
      Revision,
      Comment,
      Snapshot,
      AuditLog,
      VlassTileCache,
    ]),
  ],
  providers: [UserRepository, PostRepository],
  exports: [TypeOrmModule, UserRepository, PostRepository],
})
export class DatabaseModule {}
