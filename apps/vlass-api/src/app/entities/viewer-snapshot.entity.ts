import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('viewer_snapshots')
@Index('idx_viewer_snapshots_short_id', ['short_id'])
export class ViewerSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  file_name!: string;

  @Column({ type: 'varchar', length: 64, default: 'image/png' })
  mime_type!: string;

  @Column({ type: 'int' })
  size_bytes!: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  short_id: string | null = null;

  @Column({ type: 'jsonb', nullable: true })
  state_json: Record<string, unknown> | null = null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
