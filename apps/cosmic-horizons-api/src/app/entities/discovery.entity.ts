import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('discoveries')
export class Discovery {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 512 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  body?: string | null;

  @Column({ type: 'varchar', length: 128, default: 'anonymous' })
  author!: string;

  @Column({ type: 'jsonb', nullable: true })
  tags?: string[] | null;

  @Column({ type: 'timestamp' })
  created_at!: Date;

  @Column({ type: 'boolean', default: false })
  hidden!: boolean;
}
