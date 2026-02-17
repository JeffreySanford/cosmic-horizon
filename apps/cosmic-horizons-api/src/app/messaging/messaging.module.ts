import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { MessagingIntegrationService } from './messaging-integration.service';
import { MessagingGateway } from './messaging.gateway';
import { MessagingMonitorService } from './messaging-monitor.service';
import { MessagingStatsService } from './messaging-stats.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    MessagingService,
    MessagingStatsService,
    MessagingMonitorService,
    MessagingIntegrationService,
    MessagingGateway,
  ],
  controllers: [MessagingController],
  exports: [MessagingService, MessagingGateway],
})
export class MessagingModule {}
