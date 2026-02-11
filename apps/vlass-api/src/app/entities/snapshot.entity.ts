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
import { Post } from './post.entity';

@Entity('snapshots')
@Index('idx_snapshots_post_id', ['post_id'])
export class Snapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  post_id!: string;

  @Column({ type: 'varchar', length: 2048 })
  image_url!: string;

  @Column({ type: 'jsonb', nullable: true })
  sky_coords: {
    ra?: number;
    dec?: number;
    fov?: number;
    [key: string]: unknown;
  } | null = null;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne(() => Post, (post: Post) => post.snapshots, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'post_id' })
  post!: Relation<Post>;
}
