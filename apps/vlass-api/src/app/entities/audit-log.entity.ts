import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Relation,
} from 'typeorm';
import { User } from './user.entity';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  PUBLISH = 'publish',
  UNPUBLISH = 'unpublish',
  COMMENT = 'comment',
  LOGIN = 'login',
}

export enum AuditEntityType {
  USER = 'user',
  POST = 'post',
  REVISION = 'revision',
  COMMENT = 'comment',
  SNAPSHOT = 'snapshot',
}

@Entity('audit_logs')
@Index('idx_audit_action', ['action'])
@Index('idx_audit_entity', ['entity_type', 'entity_id'])
@Index('idx_audit_user', ['user_id'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { nullable: true })
  user_id: string | null = null;

  @Column({
    type: 'varchar',
    enum: AuditAction,
  })
  action!: AuditAction;

  @Column({
    type: 'varchar',
    enum: AuditEntityType,
  })
  entity_type!: AuditEntityType;

  @Column('uuid')
  entity_id!: string;

  @Column({ type: 'jsonb', nullable: true })
  changes: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    [key: string]: unknown;
  } | null = null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string | null = null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null = null;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne(() => User, (user: User) => user.auditLogs, {
    onDelete: 'SET NULL',
    eager: false,
  })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;
}
