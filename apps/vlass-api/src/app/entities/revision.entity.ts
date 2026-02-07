import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  Relation,
} from 'typeorm';
import { Post } from './post.entity';
import { User } from './user.entity';

@Entity('revisions')
@Index('idx_revisions_post_id', ['post_id'])
@Index('idx_revisions_created', ['created_at'])
export class Revision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  post_id!: string;

  @Column('uuid')
  user_id!: string;

  @Column({ type: 'varchar', length: 512 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description: string | null = null;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'text', nullable: true })
  change_summary: string | null = null;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne(() => Post, (post: Post) => post.revisions, {
    onDelete: 'CASCADE',
    eager: false,
  })
  post!: Relation<Post>;

  @ManyToOne(() => User, (user: User) => user.revisions, {
    onDelete: 'SET NULL',
    eager: false,
  })
  user!: Relation<User>;
}
