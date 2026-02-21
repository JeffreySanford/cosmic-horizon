import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ContextModule } from '../context/context.module';
import { EphemerisService } from './ephemeris.service';
import { EphemerisController } from './ephemeris.controller';
import { EphemerisWarmupService } from './ephemeris-warmup.service';

@Module({
  imports: [HttpModule, ContextModule],
  providers: [EphemerisService, EphemerisWarmupService],
  controllers: [EphemerisController],
  exports: [EphemerisService],
})
export class EphemerisModule {}
