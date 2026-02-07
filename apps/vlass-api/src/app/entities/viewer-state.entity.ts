import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('viewer_states')
@Index('idx_viewer_states_short_id', ['short_id'], { unique: true })
export class ViewerState {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 16, unique: true })
  short_id!: string;

  @Column({ type: 'text' })
  encoded_state!: string;

  @Column({ type: 'jsonb' })
  state_json!: Record<string, unknown>;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
