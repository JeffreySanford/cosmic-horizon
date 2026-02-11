import { Module } from '@nestjs/common';
import { TaccIntegrationService } from './tacc-integration.service';
import { JobsController } from './jobs.controller';

@Module({
  controllers: [JobsController],
  providers: [TaccIntegrationService],
  exports: [TaccIntegrationService],
})
export class JobsModule {}
