import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { MessagingIntegrationService } from './messaging-integration.service';
import { MessagingGateway } from './messaging.gateway';

@Module({
  imports: [],
  providers: [MessagingService, MessagingIntegrationService, MessagingGateway],
  controllers: [MessagingController],
  exports: [MessagingService],
})
export class MessagingModule {}
