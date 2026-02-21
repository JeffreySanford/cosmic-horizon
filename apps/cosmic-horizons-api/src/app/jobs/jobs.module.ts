import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaccIntegrationService } from './tacc-integration.service';
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
