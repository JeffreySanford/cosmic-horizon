import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ViewerState } from '../entities/viewer-state.entity';
import { ViewerSnapshot } from '../entities/viewer-snapshot.entity';
import { ViewerController } from './viewer.controller';
import { ViewerService } from './viewer.service';

@Module({
  imports: [TypeOrmModule.forFeature([ViewerState, ViewerSnapshot])],
  controllers: [ViewerController],
  providers: [ViewerService],
  exports: [ViewerService],
})
export class ViewerModule {}
