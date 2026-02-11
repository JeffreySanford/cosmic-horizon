import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Post } from './post.entity';
import { User } from './user.entity';

@Entity('comments')
@Index('idx_comments_post_id', ['post_id'])
@Index('idx_comments_user_id', ['user_id'])
@Index('idx_comments_parent_id', ['parent_id'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  post_id!: string;

  @Column('uuid')
  user_id!: string;

  @Column({ type: 'uuid', nullable: true })
  parent_id?: string | null;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date | null = null;

  @Column({ type: 'timestamp', nullable: true })
  hidden_at: Date | null = null;

  @ManyToOne(() => Post, (post: Post) => post.comments, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'post_id' })
  post!: Relation<Post>;

  @ManyToOne(() => User, (user: User) => user.comments, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @ManyToOne(() => Comment, (comment: Comment) => comment.replies, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent: Relation<Comment> | null = null;

  @OneToMany(() => Comment, (comment: Comment) => comment.parent)
  replies!: Relation<Comment[]>;
}
