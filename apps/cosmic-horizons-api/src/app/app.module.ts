import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database.module';
import { AuthModule } from './auth/auth.module';
import { ViewerModule } from './viewer/viewer.module';
import { EphemerisModule } from './ephemeris/ephemeris.module';
import { ContextModule } from './context/context.module';
import { CommentsModule } from './comments/comments.module';
import { ProfileModule } from './profile/profile.module';
import { CacheModule } from './cache/cache.module';
import { JobsModule } from './jobs/jobs.module';
import { LoggingModule } from './logging/logging.module';
import { MessagingModule } from './messaging/messaging.module';
import { EventsModule } from './modules/events/events.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CommunityModule } from './modules/community/community.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { OperationsModule } from './modules/operations/operations.module';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestLoggerInterceptor } from './interceptors/request-logger.interceptor';
import { RequestContextService } from './context/request-context.service';
import { CorrelationMiddleware } from './middleware/correlation.middleware';
import { AdminLogsController } from './controllers/admin-logs.controller';
import {
  getEnvCandidates,
  loadEnvFromFirstAvailable,
} from './config/env-loader';
import {
  validateAndAssignEnvironment,
  validateEnvironment,
} from './config/env-validation';

loadEnvFromFirstAvailable();
validateAndAssignEnvironment();
const envCandidates = getEnvCandidates();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envCandidates.length > 0 ? envCandidates : undefined,
      validate: validateEnvironment,
      // In local dev, prefer file-based env to avoid shell/session overrides.
      ignoreEnvVars: process.env.NODE_ENV !== 'production',
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    ContextModule,
    AuthModule,
    ViewerModule,
    EphemerisModule,
    CommentsModule,
    ProfileModule,
    CacheModule,
    LoggingModule,
    MessagingModule,
    JobsModule,
    EventsModule,
    NotificationsModule,
    CommunityModule,
    AuditModule,
    HealthModule,
    OperationsModule,
  ],
  controllers: [AppController, AdminLogsController],
  providers: [
    AppService,
    RateLimitGuard,
    RequestContextService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggerInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // apply correlation middleware globally so every request gets an
    // ID and the context is initialized.
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
