import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '../cache/cache.service';
import * as Astronomy from 'astronomy-engine';

@Injectable()
export class EphemerisService {
  private readonly logger = new Logger(EphemerisService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly httpService: HttpService
  ) {}

  async calculatePosition(
    objectName: string,
    epochIso: string = new Date().toISOString()
  ) {
    const object = objectName.toLowerCase();
    const dateKey = epochIso.split('T')[0];
    const cacheKey = `ephem:${object}:${dateKey}`;

    // Check cache first
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) {
      return { ...cached, source: 'cache' };
    }

    // Calculate using astronomy-engine
    const epoch = new Date(epochIso);
    const observer = new Astronomy.Observer(0, 0, 0); // Earth center (Geocentric)
    const body = this.getAstronomyObject(object);

    if (body === null) {
      // If not a major body, check for asteroid fallback (placeholder for JPL Horizons or similar)
      const asteroidResult = await this.handleAsteroidFallback(object, epochIso);
      if (asteroidResult) return asteroidResult;

      this.logger.warn(`Unknown object attempted: ${object}`);
      return null;
    }

    try {
      const equatorial = Astronomy.Equator(body, epoch, observer, false, true);

      const result = {
        ra: equatorial.ra * 15,          // Right ascension: convert hours (astronomy-engine) to degrees
        dec: equatorial.dec,             // Declination in degrees
        accuracy_arcsec: 0.1,            // Typical accuracy of astronomy-engine
        epoch: epochIso,
        source: 'astronomy-engine',
        object_type: this.classifyObject(object)
      };

      // Cache for 24 hours
      await this.cache.set(cacheKey, result, 86400);

      return result;
    } catch (error) {
      this.logger.error(`Error calculating position for ${object}`, error);
      return null;
    }
  }

  private getAstronomyObject(name: string): Astronomy.Body | null {
    const objectMap: Record<string, Astronomy.Body> = {
      'sun': Astronomy.Body.Sun,
      'moon': Astronomy.Body.Moon,
      'mercury': Astronomy.Body.Mercury,
      'venus': Astronomy.Body.Venus,
      'mars': Astronomy.Body.Mars,
      'jupiter': Astronomy.Body.Jupiter,
      'saturn': Astronomy.Body.Saturn,
      'uranus': Astronomy.Body.Uranus,
      'neptune': Astronomy.Body.Neptune,
      'pluto': Astronomy.Body.Pluto
    };

    return objectMap[name.toLowerCase()] ?? null;
  }

  private async handleAsteroidFallback(name: string, epochIso: string) {
    const date = new Date(epochIso);
    const dateStr = date.toISOString().split('T')[0];
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];

    // JPL Horizons API Query
    // Quantities: 1 (Astrometric RA & DEC), 50 (High-precision)
    const url = `https://ssd.jpl.nasa.gov/api/horizons.api`;
    const params = {
      format: 'json',
      COMMAND: `'${name}'`,
      OBJ_DATA: 'NO',
      MAKE_EPHEM: 'YES',
      EPHEM_TYPE: 'OBSERVER',
      CENTER: '500@399', // Geocentric
      START_TIME: `'${dateStr}'`,
      STOP_TIME: `'${nextDayStr}'`,
      STEP_SIZE: '1d',
      QUANTITIES: '1'
    };

    try {
      this.logger.log(`Fetching JPL Horizons data for ${name} at ${dateStr}...`);
      const response = await firstValueFrom(this.httpService.get(url, { params }));
      const resultString = response.data?.result;

      if (!resultString || resultString.includes('No matches found')) {
        return null;
      }

      // Parse RA/Dec from the result string between $$SOE and $$EOE
      const lines = resultString.split('\n');
      let foundData = false;
      let raDecLine = '';

      for (const line of lines) {
        if (line.includes('$$SOE')) {
          foundData = true;
          continue;
        }
        if (line.includes('$$EOE')) break;
        if (foundData && line.trim()) {
          raDecLine = line.trim();
          break;
        }
      }

      if (!raDecLine) return null;

      // Format: 2026-Feb-11 00:00      14 28 32.12 -15 28 42.1
      // Clean up multiple spaces
      const parts = raDecLine.replace(/\s+/g, ' ').split(' ');
      // parts[0]: Date, parts[1]: Time, parts[2]: RA_H, parts[3]: RA_M, parts[4]: RA_S, parts[5]: DEC_D, parts[6]: DEC_M, parts[7]: DEC_S
      
      const raHours = parseFloat(parts[2]) + parseFloat(parts[3]) / 60 + parseFloat(parts[4]) / 3600;
      const raDeg = raHours * 15;
      
      const decSign = parts[5].startsWith('-') ? -1 : 1;
      const decDeg = Math.abs(parseFloat(parts[5])) + parseFloat(parts[6]) / 60 + parseFloat(parts[7]) / 3600;
      const finalDec = decDeg * decSign;

      const result = {
        ra: raDeg,
        dec: finalDec,
        accuracy_arcsec: 1.0, 
        epoch: epochIso,
        source: 'jpl-horizons',
        object_type: 'asteroid'
      };

      // Cache the successful result
      const cacheKey = `ephem:${name.toLowerCase()}:${dateStr}`;
      await this.cache.set(cacheKey, result, 86400);

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`JPL Horizons fetch failed for ${name}: ${msg}`);
      return null;
    }
  }

  private classifyObject(name: string): string {
    const planets = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'sun'];
    if (planets.includes(name.toLowerCase())) {
      return 'planet';
    }
    if (name.toLowerCase() === 'moon') return 'satellite';
    return 'asteroid'; // Default for future expansions
  }
}
