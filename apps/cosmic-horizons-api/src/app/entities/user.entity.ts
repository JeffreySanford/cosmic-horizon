import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Post } from './post.entity';
import { Revision } from './revision.entity';
import { Comment } from './comment.entity';
import { AuditLog } from './audit-log.entity';

@Entity('users')
@Unique(['github_id'])
@Unique(['username'])
@Unique(['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'bigint', unique: true, nullable: true })
  github_id: number | null = null;

  @Column({ type: 'varchar', length: 255, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 255 })
  display_name!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatar_url: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  email: string | null = null;

  @Column({ type: 'varchar', length: 32, default: 'user' })
  role: 'user' | 'admin' | 'moderator' = 'user';

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  password_hash: string | null = null;

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
  posts!: Relation<Post[]>;

  @OneToMany(() => Revision, (revision: Revision) => revision.user, {
    cascade: ['remove'],
  })
  revisions!: Relation<Revision[]>;

  @OneToMany(() => Comment, (comment: Comment) => comment.user, {
    cascade: ['remove'],
  })
  comments!: Relation<Comment[]>;

  @OneToMany(() => AuditLog, (auditLog: AuditLog) => auditLog.user, {
    cascade: ['remove'],
  })
  auditLogs!: Relation<AuditLog[]>;
}
