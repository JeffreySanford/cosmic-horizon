import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('datasets')
export class Dataset {
  @PrimaryColumn()
  id: string;

  @Column({ nullable: true })
  label?: string;

  @Column({
    name: 'last_updated',
    type: 'timestamp with time zone',
    nullable: true,
  })
  lastUpdated?: Date;
}
