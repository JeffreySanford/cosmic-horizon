import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database.module';
import { AuthModule } from './auth/auth.module';
import { ViewerModule } from './viewer/viewer.module';
import { EphemerisModule } from './ephemeris/ephemeris.module';
import { CommentsModule } from './comments/comments.module';
import { ProfileModule } from './profile/profile.module';
import { CacheModule } from './cache/cache.module';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestLoggerInterceptor } from './interceptors/request-logger.interceptor';
import { AdminLogsController } from './controllers/admin-logs.controller';
import { LoggingModule } from './logging/logging.module';

const envCandidates = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env.local'),
  resolve(process.cwd(), '../../.env'),
].filter((path) => existsSync(path));

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envCandidates.length > 0 ? envCandidates : undefined,
      // In local dev, prefer file-based env to avoid shell/session overrides.
      ignoreEnvVars: process.env.NODE_ENV !== 'production',
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    ViewerModule,
    EphemerisModule,
    CommentsModule,
    ProfileModule,
    CacheModule,
    LoggingModule,
  ],
  controllers: [AppController, AdminLogsController],
  providers: [
    AppService,
    RateLimitGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggerInterceptor,
    },
  ],
})
export class AppModule {}
