import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  Relation,
} from 'typeorm';
import { User } from './user.entity';
import { Revision } from './revision.entity';
import { Comment } from './comment.entity';
import { Snapshot } from './snapshot.entity';

export enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Entity('posts')
@Index('idx_posts_user_id', ['user_id'])
@Index('idx_posts_published', ['published_at'])
@Index('idx_posts_status', ['status'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column({ type: 'varchar', length: 512 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description: string | null = null;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'varchar',
    enum: PostStatus,
    default: PostStatus.DRAFT,
  })
  status!: PostStatus;

  @Column({ type: 'timestamp', nullable: true })
  published_at: Date | null = null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date | null = null;

  @ManyToOne(() => User, (user: User) => user.posts, {
    onDelete: 'CASCADE',
    eager: false,
  })
  user!: Relation<User>;

  @OneToMany(() => Revision, (revision: Revision) => revision.post, { cascade: ['remove'] })
  revisions!: Relation<Revision[]>;

  @OneToMany(() => Comment, (comment: Comment) => comment.post, { cascade: ['remove'] })
  comments!: Relation<Comment[]>;

  @OneToMany(() => Snapshot, (snapshot: Snapshot) => snapshot.post, { cascade: ['remove'] })
  snapshots!: Relation<Snapshot[]>;
}
