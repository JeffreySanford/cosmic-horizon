import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { NotificationService } from './services/notification.service';
import { JobEventsConsumer } from './consumers/job-events.consumer';
import { MessagingModule } from '../../messaging/messaging.module';

@Module({
  imports: [EventsModule, MessagingModule],
  providers: [NotificationService, JobEventsConsumer],
  exports: [NotificationService, JobEventsConsumer],
})
export class NotificationsModule {}
