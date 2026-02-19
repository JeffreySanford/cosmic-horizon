import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../database.module';
import { ViewerState } from '../entities/viewer-state.entity';
import { ViewerSnapshot } from '../entities/viewer-snapshot.entity';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { ViewerController } from './viewer.controller';
import { ViewerService } from './viewer.service';
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [
    DatabaseModule,
    LoggingModule,
    TypeOrmModule.forFeature([ViewerState, ViewerSnapshot]),
  ],
  controllers: [ViewerController],
  providers: [ViewerService, RateLimitGuard],
  exports: [ViewerService],
})
export class ViewerModule {}
