import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Comment } from './comment.entity';
import { User } from './user.entity';

@Entity('comment_reports')
@Index('idx_reports_comment_id', ['comment_id'])
@Index('idx_reports_status', ['status'])
export class CommentReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  comment_id!: string;

  @Column('uuid')
  user_id!: string;

  @Column({ type: 'varchar', length: 255 })
  reason!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: string; // pending, reviewed, dismissed

  @CreateDateColumn()
  created_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolved_at?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  resolved_by?: string | null;

  @ManyToOne(() => Comment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment!: Relation<Comment>;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'resolved_by' })
  resolver?: Relation<User>;
}
