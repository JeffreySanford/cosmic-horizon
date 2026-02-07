import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity('vlass_tile_cache')
@Unique(['ra', 'dec'])
export class VlassTileCache {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'float8' })
  ra!: number;

  @Column({ type: 'float8' })
  dec!: number;

  @Column({ type: 'varchar', length: 2048 })
  tile_url!: string;

  @Column({ type: 'timestamp' })
  expires_at!: Date;

  @CreateDateColumn()
  created_at!: Date;
}
