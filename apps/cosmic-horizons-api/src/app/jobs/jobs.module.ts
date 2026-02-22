import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  TaccIntegrationService,
  DemoTaccAdapter,
  LocalLlmAdapter,
  LiveTaccAdapter,
  CasaTaccAdapter,
  TACC_ADAPTER,
  TaccAdapter,
} from './tacc-integration.service';
import { JobsController } from './jobs.controller';
import { JobRepository } from './repositories/job.repository';
import { JobOrchestratorService } from './services/job-orchestrator.service';
import { DatasetStagingService } from './services/dataset-staging.service';
import { AuditRetentionService } from './audit-retention.service';
import { Job } from './entities/job.entity';
import { EventsModule } from '../modules/events/events.module';
import { RepositoryModule } from '../repositories/repository.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job]),
    RepositoryModule, // provides AuditLogRepository for the retention service
    EventsModule, // Phase 3: Event infrastructure integration
  ],
  controllers: [JobsController],
  providers: [
    {
      provide: TACC_ADAPTER,
      useFactory: (config: ConfigService): TaccAdapter => {
        const mode = (
          config.get<string>('REMOTE_COMPUTE_MODE') ??
          (config.get('TACC_LIVE') === 'true' ? 'live' : 'demo')
        ).toLowerCase();

        if (mode === 'live') {
          return new LiveTaccAdapter(config);
        }

        if (mode === 'local-llm') {
          return new LocalLlmAdapter(config);
        }

        if (mode === 'astronomy' || mode === 'casa') {
          return new CasaTaccAdapter(config);
        }

        return new DemoTaccAdapter(config);
      },
      inject: [ConfigService],
    },
    DemoTaccAdapter,
    LocalLlmAdapter,
    LiveTaccAdapter,
    CasaTaccAdapter,
    TaccIntegrationService,
    JobRepository,
    JobOrchestratorService,
    DatasetStagingService,
    AuditRetentionService,
  ],
  exports: [
    TaccIntegrationService,
    JobRepository,
    JobOrchestratorService,
    DatasetStagingService,
    AuditRetentionService,
  ],
})
export class JobsModule {}
