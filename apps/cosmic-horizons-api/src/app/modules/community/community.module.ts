import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';
import { Discovery } from '../../entities/discovery.entity';
import { EventsModule } from '../events/events.module';
import { DatabaseModule } from '../../database.module';

@Module({
  imports: [DatabaseModule, TypeOrmModule.forFeature([Discovery]), EventsModule],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
