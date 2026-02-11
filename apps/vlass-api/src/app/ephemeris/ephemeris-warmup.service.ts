import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EphemerisService } from './ephemeris.service';

@Injectable()
export class EphemerisWarmupService {
  private readonly logger = new Logger(EphemerisWarmupService.name);

  constructor(private readonly ephemerisService: EphemerisService) {}

  /**
   * Daily pre-warming of the ephemeris cache at 00:00 UTC.
   * Warms today and the next 7 days for major solar system bodies.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyWarmup() {
    this.logger.log('Starting daily ephemeris cache pre-warming...');
    
    const objects = [
      'sun', 'moon', 'mercury', 'venus', 'mars', 
      'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'
    ];

    let warmedCount = 0;
    
    // Warm today + next 7 days
    for (let i = 0; i <= 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const isoDate = date.toISOString();

      for (const obj of objects) {
        try {
          await this.ephemerisService.calculatePosition(obj, isoDate);
          warmedCount++;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown error';
          this.logger.error(`Failed to pre-warm ${obj} for ${isoDate}: ${message}`);
        }
      }
    }

    this.logger.log(`Ephemeris cache pre-warming complete. Warmed ${warmedCount} entries.`);
  }
}
