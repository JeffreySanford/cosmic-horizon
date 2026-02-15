import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BrokerMetrics } from './broker-metrics.entity';
import { BrokerMetricsCollector } from './broker-metrics.collector';
import { BrokerMetricsService } from './broker-metrics.service';
import { BrokerMetricsController } from './broker-metrics.controller';

/**
 * OperationsModule
 *
 * Module for operational monitoring and metrics infrastructure.
 * Includes broker performance comparison for Phase 3.5 Pulsar evaluation.
 *
 * Exports:
 * - BrokerMetricsService: For internal use in other modules
 * - BrokerMetricsCollector: For metric extraction
 */
@Module({
  imports: [TypeOrmModule.forFeature([BrokerMetrics]), HttpModule],
  providers: [BrokerMetricsCollector, BrokerMetricsService],
  controllers: [BrokerMetricsController],
  exports: [BrokerMetricsService, BrokerMetricsCollector],
})
export class OperationsModule {}
