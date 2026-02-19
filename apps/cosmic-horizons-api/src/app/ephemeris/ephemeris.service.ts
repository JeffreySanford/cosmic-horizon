import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '../cache/cache.service';
import * as Astronomy from 'astronomy-engine';

export interface EphemerisResult {
  target: string;
  ra: number;
  dec: number;
  accuracy_arcsec: number;
  epoch: string;
  source: 'astronomy-engine' | 'jpl-horizons' | 'cache';
  object_type: 'planet' | 'satellite' | 'asteroid';
  sky_preview_url?: string;
  aladin_url?: string;
}

@Injectable()
export class EphemerisService {
  private readonly logger = new Logger(EphemerisService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly httpService: HttpService,
  ) {}

  async calculatePosition(
    objectName: string,
    epochIso: string = new Date().toISOString(),
  ): Promise<EphemerisResult | null> {
    const object = objectName.trim().toLowerCase();
    const dateKey = epochIso.split('T')[0];
    const cacheKey = `ephem:${object}:${dateKey}`;

    // Check cache first
    const cached = await this.cache.get<
      Omit<EphemerisResult, 'source'> | EphemerisResult
    >(cacheKey);
    if (cached) {
      const target = cached.target ?? object;
      return {
        ...cached,
        target,
        source: 'cache',
        sky_preview_url:
          cached.sky_preview_url ??
          this.buildSkyPreviewUrl(cached.ra, cached.dec),
        aladin_url:
          cached.aladin_url ??
          this.buildAladinUrl(cached.ra, cached.dec, target),
      };
    }

    // Calculate using astronomy-engine
    const epoch = new Date(epochIso);
    const observer = new Astronomy.Observer(0, 0, 0); // Earth center (Geocentric)
    const body = this.getAstronomyObject(object);

    if (body === null) {
      // If not a major body, check for asteroid fallback (placeholder for JPL Horizons or similar)
      const asteroidResult = await this.handleAsteroidFallback(
        object,
        epochIso,
      );
      if (asteroidResult) return asteroidResult;

      this.logger.warn(`Unknown object attempted: ${object}`);
      return null;
    }

    try {
      const equatorial = Astronomy.Equator(body, epoch, observer, false, true);
      const raDeg = equatorial.ra * 15;
      const decDeg = equatorial.dec;

      const result: EphemerisResult = {
        target: object,
        ra: raDeg, // Right ascension: convert hours (astronomy-engine) to degrees
        dec: decDeg, // Declination in degrees
        accuracy_arcsec: 0.1, // Typical accuracy of astronomy-engine
        epoch: epochIso,
        source: 'astronomy-engine',
        object_type: this.classifyObject(object),
        sky_preview_url: this.buildSkyPreviewUrl(raDeg, decDeg),
        aladin_url: this.buildAladinUrl(raDeg, decDeg, object),
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
      sun: Astronomy.Body.Sun,
      moon: Astronomy.Body.Moon,
      mercury: Astronomy.Body.Mercury,
      venus: Astronomy.Body.Venus,
      mars: Astronomy.Body.Mars,
      jupiter: Astronomy.Body.Jupiter,
      saturn: Astronomy.Body.Saturn,
      uranus: Astronomy.Body.Uranus,
      neptune: Astronomy.Body.Neptune,
      pluto: Astronomy.Body.Pluto,
    };

    return objectMap[name.toLowerCase()] ?? null;
  }

  private async handleAsteroidFallback(
    name: string,
    epochIso: string,
  ): Promise<EphemerisResult | null> {
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
      QUANTITIES: '1',
    };

    try {
      this.logger.log(
        `Fetching JPL Horizons data for ${name} at ${dateStr}...`,
      );
      const response = await firstValueFrom(
        this.httpService.get(url, { params }),
      );
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

      const raHours =
        parseFloat(parts[2]) +
        parseFloat(parts[3]) / 60 +
        parseFloat(parts[4]) / 3600;
      const raDeg = raHours * 15;

      const decSign = parts[5].startsWith('-') ? -1 : 1;
      const decDeg =
        Math.abs(parseFloat(parts[5])) +
        parseFloat(parts[6]) / 60 +
        parseFloat(parts[7]) / 3600;
      const finalDec = decDeg * decSign;

      const normalizedName = name.toLowerCase();
      const result: EphemerisResult = {
        target: normalizedName,
        ra: raDeg,
        dec: finalDec,
        accuracy_arcsec: 1.0,
        epoch: epochIso,
        source: 'jpl-horizons',
        object_type: 'asteroid',
        sky_preview_url: this.buildSkyPreviewUrl(raDeg, finalDec),
        aladin_url: this.buildAladinUrl(raDeg, finalDec, normalizedName),
      };

      // Cache the successful result
      const cacheKey = `ephem:${normalizedName}:${dateStr}`;
      await this.cache.set(cacheKey, result, 86400);

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`JPL Horizons fetch failed for ${name}: ${msg}`);
      return null;
    }
  }

  private classifyObject(name: string): EphemerisResult['object_type'] {
    const planets = [
      'mercury',
      'venus',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'pluto',
      'sun',
    ];
    if (planets.includes(name.toLowerCase())) {
      return 'planet';
    }
    if (name.toLowerCase() === 'moon') return 'satellite';
    return 'asteroid'; // Default for future expansions
  }

  private buildSkyPreviewUrl(ra: number, dec: number): string {
    const params = new URLSearchParams();
    params.set('hips', 'CDS/P/DSS2/color');
    params.set('format', 'jpg');
    params.set('projection', 'TAN');
    params.set('ra', ra.toFixed(6));
    params.set('dec', dec.toFixed(6));
    params.set('fov', ((2 * Math.PI) / 180).toString());
    params.set('width', '512');
    params.set('height', '512');
    return `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?${params.toString()}`;
  }

  private buildAladinUrl(ra: number, dec: number, target: string): string {
    const params = new URLSearchParams();
    params.set('target', `${ra.toFixed(6)} ${dec.toFixed(6)}`);
    params.set('fov', '1');
    params.set('survey', 'P/DSS2/color');
    if (target.trim().length > 0) {
      params.set('title', `Ephemeris:${target}`);
    }
    return `https://aladin.u-strasbg.fr/AladinLite/?${params.toString()}`;
  }
}
