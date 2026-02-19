import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaService } from '../../events/kafka.service';
import {
  SystemHealthMonitorService,
  HealthMetric,
} from '../services/system-health-monitor.service';

/**
 * SystemHealthConsumer subscribes to system health events
 * Monitors system metrics and triggers alerts on threshold violations
 */
@Injectable()
export class SystemHealthConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('SystemHealthConsumer');

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly systemHealthMonitorService: SystemHealthMonitorService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafkaService.subscribe(
      'health-consumer-group',
      ['system-health'],
      this.handleHealthEvent.bind(this),
    );
    this.logger.log(
      'SystemHealthConsumer initialized and subscribed to system-health',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.kafkaService.disconnect();
    this.logger.log('SystemHealthConsumer disconnected');
  }

  /**
   * Handle incoming health metric event
   */
  private async handleHealthEvent(payload: EachMessagePayload): Promise<void> {
    try {
      const metric = JSON.parse(
        payload.message.value?.toString() || '{}',
      ) as HealthMetric;

      this.logger.debug(
        `Received health metric for job ${metric.job_id}: error_rate=${metric.error_rate}%`,
      );

      // Process health event through monitoring service
      await this.systemHealthMonitorService.processHealthEvent(metric);
    } catch (error) {
      this.logger.warn(
        `Failed to process health event: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Non-blocking error handling - continue consuming
    }
  }
}
