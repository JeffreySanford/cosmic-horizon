import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  Relation,
} from 'typeorm';
import { Post } from './post.entity';
import { User } from './user.entity';

@Entity('comments')
@Index('idx_comments_post_id', ['post_id'])
@Index('idx_comments_user_id', ['user_id'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  post_id!: string;

  @Column('uuid')
  user_id!: string;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date | null = null;

  @ManyToOne(() => Post, (post: Post) => post.comments, {
    onDelete: 'CASCADE',
    eager: false,
  })
  post!: Relation<Post>;

  @ManyToOne(() => User, (user: User) => user.comments, {
    onDelete: 'CASCADE',
    eager: false,
  })
  user!: Relation<User>;
}
