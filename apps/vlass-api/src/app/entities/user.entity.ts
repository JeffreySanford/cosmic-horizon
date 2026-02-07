import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { Post } from './post.entity';
import { Revision } from './revision.entity';
import { Comment } from './comment.entity';
import { AuditLog } from './audit-log.entity';

@Entity('users')
@Unique(['github_id'])
@Unique(['username'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'bigint', unique: true })
  github_id!: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 255 })
  display_name!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatar_url: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null = null;

  @Column({ type: 'text', nullable: true })
  bio: string | null = null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  github_profile_url: string | null = null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date | null = null;

  @OneToMany(() => Post, (post: Post) => post.user, { cascade: ['remove'] })
  posts!: Post[];

  @OneToMany(() => Revision, (revision: Revision) => revision.user, { cascade: ['remove'] })
  revisions!: Revision[];

  @OneToMany(() => Comment, (comment: Comment) => comment.user, { cascade: ['remove'] })
  comments!: Comment[];

  @OneToMany(() => AuditLog, (auditLog: AuditLog) => auditLog.user, { cascade: ['remove'] })
  auditLogs!: AuditLog[];
}
