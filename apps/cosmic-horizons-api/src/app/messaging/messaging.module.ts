import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { MessagingIntegrationService } from './messaging-integration.service';
import { MessagingGateway } from './messaging.gateway';

@Module({
  imports: [],
  providers: [MessagingService, MessagingIntegrationService],
  controllers: [MessagingController],
  exports: [MessagingService],
})
export class MessagingModule {}

// Export the gateway and integration service separately for manual lazy loading if needed
export { MessagingGateway } from './messaging.gateway';
export { MessagingIntegrationService } from './messaging-integration.service';
