import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
  User,
  Post,
  Revision,
  Comment,
  Snapshot,
  AuditLog,
  VlassTileCache,
} from './entities';

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '15432', 10),
  username: process.env.DB_USER || 'vlass_user',
  password: process.env.DB_PASSWORD || 'vlass_password_dev',
  database: process.env.DB_NAME || 'vlass_portal',
  entities: [User, Post, Revision, Comment, Snapshot, AuditLog, VlassTileCache],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  extra: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
});
