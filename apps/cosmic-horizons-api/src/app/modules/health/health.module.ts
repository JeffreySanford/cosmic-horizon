import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { SystemHealthMonitorService } from './services/system-health-monitor.service';
import { SystemHealthConsumer } from './consumers/system-health.consumer';
import { HealthController } from './health.controller';

@Module({
  imports: [EventsModule],
  controllers: [HealthController],
  providers: [SystemHealthMonitorService, SystemHealthConsumer],
  exports: [SystemHealthMonitorService, SystemHealthConsumer],
})
export class HealthModule {}
