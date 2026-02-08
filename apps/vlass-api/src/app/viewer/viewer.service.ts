import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { DataSource, Repository } from 'typeorm';
import { ViewerState } from '../entities/viewer-state.entity';
import { ViewerSnapshot } from '../entities/viewer-snapshot.entity';
import { AuditAction, AuditEntityType } from '../entities/audit-log.entity';
import { AuditLogRepository } from '../repositories';
import { CreateViewerSnapshotDto } from './dto/create-viewer-snapshot.dto';
import { ViewerStatePayload } from './dto/create-viewer-state.dto';
import { ViewerCutoutRequest } from './dto/viewer-cutout.dto';
import { LoggingService } from '../logging/logging.service';

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

interface CutoutCacheEntry {
  expiresAt: number;
  buffer: Buffer;
}

interface CutoutFetchResult {
  buffer: Buffer;
  survey: string;
  provider: 'primary' | 'secondary';
  attempts: number;
  cacheHit: boolean;
  cacheSource: 'memory' | 'redis' | 'none';
}

interface CutoutFailureEvent {
  at: string;
  reason: string;
}

export interface CutoutTelemetrySnapshot {
  requests_total: number;
  success_total: number;
  failure_total: number;
  provider_attempts_total: number;
  provider_failures_total: number;
  cache_hits_total: number;
  resolution_fallback_total: number;
  survey_fallback_total: number;
  provider_fallback_total: number;
  primary_success_total: number;
  secondary_success_total: number;
  consecutive_failures: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_failure_reason: string | null;
  recent_failures: CutoutFailureEvent[];
}

interface SimbadTapMetadataColumn {
  name?: string;
}

interface SimbadTapResponse {
  metadata?: SimbadTapMetadataColumn[];
  data?: unknown[][];
}

export interface NearbyCatalogLabel {
  name: string;
  ra: number;
  dec: number;
  object_type: string;
  angular_distance_deg: number;
  confidence: number;
}

@Injectable()
export class ViewerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ViewerService.name);
  private readonly cutoutCache = new Map<string, CutoutCacheEntry>();
  private readonly nearbyLabelsCache = new Map<string, { expiresAt: number; labels: NearbyCatalogLabel[] }>();
  private redisClient: Redis | null = null;
  private redisEnabled = false;
  private lastNearbyLabelsWarnAt = 0;
  private lastNearbyLabelsWarnMessage = '';
  private readonly cutoutTelemetry: {
    requestsTotal: number;
    successTotal: number;
    failureTotal: number;
    providerAttemptsTotal: number;
    providerFailuresTotal: number;
    cacheHitsTotal: number;
    resolutionFallbackTotal: number;
    surveyFallbackTotal: number;
    providerFallbackTotal: number;
    primarySuccessTotal: number;
    secondarySuccessTotal: number;
    consecutiveFailures: number;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastFailureReason: string | null;
    recentFailures: CutoutFailureEvent[];
  } = {
    requestsTotal: 0,
    successTotal: 0,
    failureTotal: 0,
    providerAttemptsTotal: 0,
    providerFailuresTotal: 0,
    cacheHitsTotal: 0,
    resolutionFallbackTotal: 0,
    surveyFallbackTotal: 0,
    providerFallbackTotal: 0,
    primarySuccessTotal: 0,
    secondarySuccessTotal: 0,
    consecutiveFailures: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
    recentFailures: [],
  };

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ViewerState)
    private readonly viewerStateRepository: Repository<ViewerState>,
    @InjectRepository(ViewerSnapshot)
    private readonly viewerSnapshotRepository: Repository<ViewerSnapshot>,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly loggingService: LoggingService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureViewerTables();
    await this.initializeRedisCache();
    this.logCacheConfiguration();
    this.scheduleWarmupIfEnabled();
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    try {
      await this.redisClient.quit();
    } catch {
      await this.redisClient.disconnect();
    } finally {
      this.redisClient = null;
      this.redisEnabled = false;
    }
  }

  async createState(state: ViewerStatePayload) {
    this.validateState(state);

    const shortId = await this.generateShortId();
    const encodedState = this.encodeState(state);

    const saved = await this.viewerStateRepository.save(
      this.viewerStateRepository.create({
        short_id: shortId,
        encoded_state: encodedState,
        state_json: state as unknown as Record<string, unknown>,
      }),
    );

    return {
      id: saved.id,
      short_id: saved.short_id,
      encoded_state: saved.encoded_state,
      state: saved.state_json,
      permalink_path: `/view/${saved.short_id}`,
      created_at: saved.created_at,
    };
  }

  async resolveState(shortId: string) {
    const saved = await this.viewerStateRepository.findOne({
      where: { short_id: shortId },
    });

    if (!saved) {
      throw new NotFoundException(`Viewer state ${shortId} was not found.`);
    }

    return {
      id: saved.id,
      short_id: saved.short_id,
      encoded_state: saved.encoded_state,
      state: saved.state_json,
      created_at: saved.created_at,
    };
  }

  async createSnapshot(payload: CreateViewerSnapshotDto) {
    if (!payload.image_data_url || !payload.image_data_url.startsWith('data:image/png;base64,')) {
      throw new BadRequestException('image_data_url must be a PNG data URL.');
    }

    if (payload.state) {
      this.validateState(payload.state);
    }

    const rawBase64 = payload.image_data_url.slice('data:image/png;base64,'.length);
    const pngBuffer = Buffer.from(rawBase64, 'base64');

    if (pngBuffer.length === 0) {
      throw new BadRequestException('Snapshot payload is empty.');
    }

    const maxBytes = 5 * 1024 * 1024;
    if (pngBuffer.length > maxBytes) {
      throw new BadRequestException('Snapshot exceeds 5MB size limit.');
    }

    const snapshotId = randomUUID();
    const fileName = `${snapshotId}.png`;
    const storageDir = resolve(this.resolveApiRootDir(), 'storage', 'snapshots');

    mkdirSync(storageDir, { recursive: true });
    writeFileSync(resolve(storageDir, fileName), pngBuffer);

    const snapshot = await this.viewerSnapshotRepository.save(
      this.viewerSnapshotRepository.create({
        id: snapshotId,
        file_name: fileName,
        mime_type: 'image/png',
        size_bytes: pngBuffer.length,
        short_id: payload.short_id ?? null,
        state_json: payload.state ? (payload.state as unknown as Record<string, unknown>) : null,
      }),
    );

    await this.auditLogRepository.createAuditLog({
      action: AuditAction.CREATE,
      entity_type: AuditEntityType.SNAPSHOT,
      entity_id: snapshot.id,
      changes: {
        type: 'viewer_snapshot',
        short_id: snapshot.short_id,
        size_bytes: snapshot.size_bytes,
      },
    });

    return {
      id: snapshot.id,
      image_url: `/api/view/snapshots/${snapshot.file_name}`,
      short_id: snapshot.short_id,
      size_bytes: snapshot.size_bytes,
      created_at: snapshot.created_at,
    };
  }

  getCutoutTelemetry(): CutoutTelemetrySnapshot {
    return {
      requests_total: this.cutoutTelemetry.requestsTotal,
      success_total: this.cutoutTelemetry.successTotal,
      failure_total: this.cutoutTelemetry.failureTotal,
      provider_attempts_total: this.cutoutTelemetry.providerAttemptsTotal,
      provider_failures_total: this.cutoutTelemetry.providerFailuresTotal,
      cache_hits_total: this.cutoutTelemetry.cacheHitsTotal,
      resolution_fallback_total: this.cutoutTelemetry.resolutionFallbackTotal,
      survey_fallback_total: this.cutoutTelemetry.surveyFallbackTotal,
      provider_fallback_total: this.cutoutTelemetry.providerFallbackTotal,
      primary_success_total: this.cutoutTelemetry.primarySuccessTotal,
      secondary_success_total: this.cutoutTelemetry.secondarySuccessTotal,
      consecutive_failures: this.cutoutTelemetry.consecutiveFailures,
      last_success_at: this.cutoutTelemetry.lastSuccessAt,
      last_failure_at: this.cutoutTelemetry.lastFailureAt,
      last_failure_reason: this.cutoutTelemetry.lastFailureReason,
      recent_failures: [...this.cutoutTelemetry.recentFailures],
    };
  }

  async downloadCutout(request: ViewerCutoutRequest): Promise<{ buffer: Buffer; fileName: string }> {
    this.validateState({
      ra: request.ra,
      dec: request.dec,
      fov: request.fov,
      survey: request.survey,
      labels: [],
    });

    const fallbackSurveys = this.cutoutSurveyFallbacks(request.survey);
    this.cutoutTelemetry.requestsTotal += 1;
    const maxAttempts = 3;
    const detail = request.detail ?? 'standard';
    const dimensionsCandidates = this.cutoutDimensionsCandidates(detail);
    let buffer: Buffer | null = null;
    let selectedDimensions = dimensionsCandidates[0];
    let selectedSurvey = fallbackSurveys[0];
    let selectedProvider: 'primary' | 'secondary' = 'primary';
    let lastError: unknown = null;
    let cacheHit = false;
    let totalAttempts = 0;

    for (const dimensions of dimensionsCandidates) {
      try {
        const result = await this.fetchCutoutWithRetries({
          request,
          fallbackSurveys,
          maxAttempts,
          width: dimensions.width,
          height: dimensions.height,
        });
        buffer = result.buffer;
        selectedDimensions = dimensions;
        selectedSurvey = result.survey;
        selectedProvider = result.provider;
        cacheHit = result.cacheHit;
        totalAttempts += result.attempts;
        this.logCutoutCacheEvent(result.cacheSource, selectedProvider, selectedSurvey, dimensions.width, dimensions.height);
        break;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Cutout fetch failed at ${dimensions.width}x${dimensions.height}; trying lower resolution if available.`,
        );
      }
    }

    if (!buffer) {
      this.markCutoutFailure(lastError);
      throw lastError;
    }

    this.markCutoutSuccess(selectedProvider);
    if (cacheHit) {
      this.cutoutTelemetry.cacheHitsTotal += 1;
    }
    if (selectedDimensions.width < dimensionsCandidates[0].width) {
      this.cutoutTelemetry.resolutionFallbackTotal += 1;
    }
    if (selectedSurvey !== fallbackSurveys[0]) {
      this.cutoutTelemetry.surveyFallbackTotal += 1;
    }
    if (selectedProvider === 'secondary') {
      this.cutoutTelemetry.providerFallbackTotal += 1;
    }

    const safeLabel = request.label?.trim().replace(/[^a-zA-Z0-9_-]+/g, '-');
    const fileNameStem = safeLabel && safeLabel.length > 0 ? safeLabel : `ra${request.ra.toFixed(4)}_dec${request.dec.toFixed(4)}`;
    const auditId = randomUUID();
    await this.auditLogRepository.createAuditLog({
      action: AuditAction.CREATE,
      entity_type: AuditEntityType.SNAPSHOT,
      entity_id: auditId,
      changes: {
        type: 'viewer_cutout',
        survey: request.survey,
        detail,
        width: selectedDimensions.width,
        height: selectedDimensions.height,
        ra: request.ra,
        dec: request.dec,
        fov: request.fov,
        survey_resolved: selectedSurvey,
        provider_resolved: selectedProvider,
        provider_attempts: totalAttempts,
        cache_hit: cacheHit,
        size_bytes: buffer.length,
      },
    });

    return {
      buffer,
      fileName: `${fileNameStem}.fits`,
    };
  }

  async getNearbyLabels(ra: number, dec: number, radiusDeg: number, limit: number): Promise<NearbyCatalogLabel[]> {
    this.validateState({
      ra,
      dec,
      fov: Math.max(radiusDeg, 0.001),
      survey: 'SIMBAD',
      labels: [],
    });

    const normalizedRadius = Number(radiusDeg.toFixed(5));
    const normalizedLimit = Math.max(1, Math.min(limit, 25));
    const nearbyCacheKey = this.nearbyLabelsCacheKey(ra, dec, normalizedRadius, normalizedLimit);
    const cachedNearby = await this.getNearbyLabelsFromCache(nearbyCacheKey);
    if (cachedNearby) {
      this.logNearbyCacheEvent('hit', cachedNearby.source, normalizedLimit, normalizedRadius);
      return cachedNearby;
    }
    this.logNearbyCacheEvent('miss', 'none', normalizedLimit, normalizedRadius);
    const query = [
      `SELECT TOP ${normalizedLimit}`,
      'main_id, ra, dec, otype_txt,',
      `DISTANCE(POINT('ICRS', ra, dec), POINT('ICRS', ${ra.toFixed(6)}, ${dec.toFixed(6)})) AS ang_dist`,
      'FROM basic',
      `WHERE CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', ${ra.toFixed(6)}, ${dec.toFixed(6)}, ${normalizedRadius})) = 1`,
      'AND main_id IS NOT NULL',
      'ORDER BY ang_dist ASC',
    ].join(' ');

    const formBody = new URLSearchParams({
      request: 'doQuery',
      lang: 'adql',
      format: 'json',
      query,
    });

    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), 6_000);
      const response = await fetch('https://simbad.cds.unistra.fr/simbad/sim-tap/sync', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: formBody.toString(),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutHandle));

      if (!response.ok) {
        this.warnNearbyLabels(`SIMBAD nearby-label query failed with status ${response.status}. Returning empty labels.`);
        return [];
      }

      const payload = (await response.json()) as SimbadTapResponse;
      const rows = this.parseSimbadRows(payload);
      const normalized = rows
        .filter((row) => Number.isFinite(row.ra) && Number.isFinite(row.dec) && Number.isFinite(row.angular_distance_deg))
        .map((row) => ({
          ...row,
          confidence: this.computeCatalogConfidence(row, normalizedRadius),
        }));
      await this.setNearbyLabelsCache(nearbyCacheKey, normalized);
      return normalized;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.warnNearbyLabels(`SIMBAD nearby-label query failed (${message}). Returning empty labels.`);
      return [];
    }
  }

  encodeState(state: ViewerStatePayload): string {
    return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
  }

  decodeState(encodedState: string): ViewerStatePayload {
    try {
      const parsed = JSON.parse(Buffer.from(encodedState, 'base64url').toString('utf8')) as ViewerStatePayload;
      this.validateState(parsed);
      return parsed;
    } catch {
      throw new BadRequestException('Encoded viewer state is invalid.');
    }
  }

  private validateState(state: ViewerStatePayload): void {
    if (!Number.isFinite(state.ra) || state.ra < -360 || state.ra > 360) {
      throw new BadRequestException('RA must be a finite number between -360 and 360.');
    }

    if (!Number.isFinite(state.dec) || state.dec < -90 || state.dec > 90) {
      throw new BadRequestException('Dec must be a finite number between -90 and 90.');
    }

    if (!Number.isFinite(state.fov) || state.fov <= 0 || state.fov > 180) {
      throw new BadRequestException('FOV must be a finite number in (0, 180].');
    }

    if (typeof state.survey !== 'string' || state.survey.trim().length < 2) {
      throw new BadRequestException('Survey must be a non-empty string.');
    }

    if (state.labels && !Array.isArray(state.labels)) {
      throw new BadRequestException('labels must be an array when provided.');
    }

    if (state.labels) {
      if (state.labels.length > 100) {
        throw new BadRequestException('labels cannot exceed 100 entries.');
      }

      for (const label of state.labels) {
        if (typeof label.name !== 'string' || label.name.trim().length === 0 || label.name.length > 120) {
          throw new BadRequestException('Each label requires a name between 1 and 120 characters.');
        }

        if (!Number.isFinite(label.ra) || label.ra < -360 || label.ra > 360) {
          throw new BadRequestException('Each label RA must be between -360 and 360.');
        }

        if (!Number.isFinite(label.dec) || label.dec < -90 || label.dec > 90) {
          throw new BadRequestException('Each label Dec must be between -90 and 90.');
        }
      }
    }
  }

  private normalizeSurveyForCutout(survey: string): string {
    const trimmed = survey.trim();
    if (trimmed.length === 0) {
      return 'CDS/P/DSS2/color';
    }

    if (trimmed.startsWith('CDS/')) {
      return trimmed;
    }

    return `CDS/${trimmed}`;
  }

  private cutoutSurveyFallbacks(survey: string): string[] {
    const normalized = this.normalizeSurveyForCutout(survey);

    if (normalized.includes('/P/VLASS/QL')) {
      return [
        normalized,
        'CDS/P/PanSTARRS/DR1/color-z-zg-g',
        'CDS/P/DSS2/color',
      ];
    }

    return [normalized, 'CDS/P/DSS2/color'];
  }

  private async fetchCutoutWithRetries(params: {
    request: ViewerCutoutRequest;
    fallbackSurveys: string[];
    maxAttempts: number;
    width: number;
    height: number;
  }): Promise<CutoutFetchResult> {
    let lastErrorMessage = 'no response from provider';
    let attemptsUsed = 0;
    const providerOrder = this.cutoutProviderOrder();

    for (const survey of params.fallbackSurveys) {
      for (let attempt = 1; attempt <= params.maxAttempts; attempt += 1) {
        for (const provider of providerOrder) {
          try {
            const cacheKey = this.cutoutCacheKey(params.request, survey, provider, params.width, params.height);
            const cached = await this.getCutoutFromCache(cacheKey);
            if (cached) {
              return {
                buffer: cached.buffer,
                survey,
                provider,
                attempts: attemptsUsed,
                cacheHit: true,
                cacheSource: cached.source,
              };
            }

            attemptsUsed += 1;
            this.cutoutTelemetry.providerAttemptsTotal += 1;
            const cutoutUrl =
              provider === 'primary'
                ? this.buildPrimaryCutoutUrl(params.request, survey, params.width, params.height)
                : this.buildSecondaryCutoutUrl(params.request, survey, params.width, params.height);
            const response = await this.fetchCutoutResponse(cutoutUrl, provider);

            if (!response.ok) {
              lastErrorMessage = `status ${response.status}`;
              this.cutoutTelemetry.providerFailuresTotal += 1;
              this.logger.warn(`Cutout fetch failed (${provider}:${survey}, attempt ${attempt}): ${lastErrorMessage}`);
              continue;
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            if (buffer.length === 0) {
              lastErrorMessage = 'empty payload';
              this.cutoutTelemetry.providerFailuresTotal += 1;
              this.logger.warn(`Cutout fetch failed (${provider}:${survey}, attempt ${attempt}): ${lastErrorMessage}`);
              continue;
            }

            await this.setCutoutCache(cacheKey, buffer);
            return {
              buffer,
              survey,
              provider,
              attempts: attemptsUsed,
              cacheHit: false,
              cacheSource: 'none',
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'unknown fetch error';
            lastErrorMessage = errorMessage;
            this.cutoutTelemetry.providerFailuresTotal += 1;
            this.logger.warn(`Cutout fetch failed (${provider}:${survey}, attempt ${attempt}): ${lastErrorMessage}`);
          }
        }
      }
    }

    throw new ServiceUnavailableException(
      `Science cutout provider is temporarily unavailable (${lastErrorMessage}). Try again or use a wider field.`,
    );
  }

  private buildPrimaryCutoutUrl(request: ViewerCutoutRequest, survey: string, width: number, height: number): URL {
    const cutoutUrl = new URL('https://alasky.cds.unistra.fr/hips-image-services/hips2fits');
    cutoutUrl.searchParams.set('hips', survey);
    cutoutUrl.searchParams.set('format', 'fits');
    cutoutUrl.searchParams.set('projection', 'TAN');
    cutoutUrl.searchParams.set('ra', request.ra.toString());
    cutoutUrl.searchParams.set('dec', request.dec.toString());
    cutoutUrl.searchParams.set('fov', this.degToRad(request.fov).toString());
    cutoutUrl.searchParams.set('width', width.toString());
    cutoutUrl.searchParams.set('height', height.toString());
    return cutoutUrl;
  }

  private buildSecondaryCutoutUrl(request: ViewerCutoutRequest, survey: string, width: number, height: number): URL {
    const template = process.env['CUTOUT_SECONDARY_URL_TEMPLATE'] ?? '';
    if (template.trim().length === 0) {
      throw new Error('secondary cutout template is not configured');
    }

    const fovRadians = this.degToRad(request.fov);
    const rendered = template
      .replaceAll('{ra}', encodeURIComponent(request.ra.toString()))
      .replaceAll('{dec}', encodeURIComponent(request.dec.toString()))
      .replaceAll('{fov}', encodeURIComponent(request.fov.toString()))
      .replaceAll('{fov_rad}', encodeURIComponent(fovRadians.toString()))
      .replaceAll('{survey}', encodeURIComponent(survey))
      .replaceAll('{width}', encodeURIComponent(width.toString()))
      .replaceAll('{height}', encodeURIComponent(height.toString()));

    return new URL(rendered);
  }

  private cutoutProviderOrder(): Array<'primary' | 'secondary'> {
    const secondaryEnabled = (process.env['CUTOUT_SECONDARY_ENABLED'] ?? '').toLowerCase() === 'true';
    const template = process.env['CUTOUT_SECONDARY_URL_TEMPLATE'] ?? '';
    if (secondaryEnabled && template.trim().length > 0) {
      return ['primary', 'secondary'];
    }

    return ['primary'];
  }

  private async fetchCutoutResponse(url: URL, provider: 'primary' | 'secondary'): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs =
      provider === 'secondary'
        ? Number(process.env['CUTOUT_SECONDARY_TIMEOUT_MS'] || process.env['CUTOUT_FETCH_TIMEOUT_MS'] || 25_000)
        : Number(process.env['CUTOUT_FETCH_TIMEOUT_MS'] || 25_000);
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      Accept: 'application/fits, application/octet-stream;q=0.9',
    };
    if (provider === 'secondary') {
      const token = process.env['CUTOUT_SECONDARY_API_KEY'];
      if (token && token.trim().length > 0) {
        const keyHeader = process.env['CUTOUT_SECONDARY_API_KEY_HEADER'] || 'Authorization';
        const keyPrefix = process.env['CUTOUT_SECONDARY_API_KEY_PREFIX'] ?? 'Bearer ';
        headers[keyHeader] = `${keyPrefix}${token}`;
      }
      const keyQueryParam = process.env['CUTOUT_SECONDARY_API_KEY_QUERY_PARAM'];
      if (keyQueryParam && keyQueryParam.trim().length > 0 && token && token.trim().length > 0) {
        url.searchParams.set(keyQueryParam, token);
      }
    }

    return fetch(url, {
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutHandle));
  }

  private parseSimbadRows(payload: SimbadTapResponse): NearbyCatalogLabel[] {
    if (!Array.isArray(payload.metadata) || !Array.isArray(payload.data)) {
      return [];
    }

    const indexByName = new Map<string, number>();
    payload.metadata.forEach((column, index) => {
      if (typeof column.name === 'string') {
        indexByName.set(column.name.toLowerCase(), index);
      }
    });

    const getIndex = (name: string): number => indexByName.get(name.toLowerCase()) ?? -1;
    const nameIndex = getIndex('main_id');
    const raIndex = getIndex('ra');
    const decIndex = getIndex('dec');
    const typeIndex = getIndex('otype_txt');
    const distanceIndex = getIndex('ang_dist');

    const rows: NearbyCatalogLabel[] = [];
    for (const row of payload.data) {
      if (!Array.isArray(row)) {
        continue;
      }

      const name = this.readStringCell(row, nameIndex);
      const ra = this.readNumberCell(row, raIndex);
      const dec = this.readNumberCell(row, decIndex);
      const objectType = this.readStringCell(row, typeIndex) || 'Unknown';
      const angularDistanceDeg = this.readNumberCell(row, distanceIndex);

      if (!name || !Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(angularDistanceDeg)) {
        continue;
      }

      rows.push({
        name,
        ra,
        dec,
        object_type: objectType,
        angular_distance_deg: Number(angularDistanceDeg.toFixed(6)),
        confidence: 0.8,
      });
    }

    return rows;
  }

  private readStringCell(row: unknown[], index: number): string {
    if (index < 0 || index >= row.length) {
      return '';
    }

    const value = row[index];
    return typeof value === 'string' ? value.trim() : '';
  }

  private readNumberCell(row: unknown[], index: number): number {
    if (index < 0 || index >= row.length) {
      return Number.NaN;
    }

    const value = row[index];
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    }

    return Number.NaN;
  }

  private computeCatalogConfidence(label: NearbyCatalogLabel, searchRadius: number): number {
    let confidence = 0.4;

    if (!label.name.startsWith('[')) {
      confidence += 0.2;
    }

    if (label.object_type !== 'Unknown') {
      confidence += 0.2;
    }

    if (label.angular_distance_deg <= searchRadius * 0.25) {
      confidence += 0.2;
    }

    return Number(Math.max(0, Math.min(confidence, 1)).toFixed(2));
  }

  private warnNearbyLabels(message: string): void {
    const now = Date.now();
    const throttleMs = 60_000;
    if (message === this.lastNearbyLabelsWarnMessage && now - this.lastNearbyLabelsWarnAt < throttleMs) {
      return;
    }

    this.lastNearbyLabelsWarnAt = now;
    this.lastNearbyLabelsWarnMessage = message;
    this.logger.warn(message);
  }

  private degToRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  private cutoutDimensionsCandidates(detail: 'standard' | 'high' | 'max'): Array<{ width: number; height: number }> {
    if (detail === 'max') {
      return [
        { width: 3072, height: 3072 },
        { width: 2048, height: 2048 },
        { width: 1024, height: 1024 },
      ];
    }
    if (detail === 'high') {
      return [
        { width: 2048, height: 2048 },
        { width: 1024, height: 1024 },
      ];
    }

    return [{ width: 1024, height: 1024 }];
  }

  private cutoutCacheKey(
    request: ViewerCutoutRequest,
    survey: string,
    provider: 'primary' | 'secondary',
    width: number,
    height: number,
  ): string {
    return [
      provider,
      survey,
      request.ra.toFixed(6),
      request.dec.toFixed(6),
      request.fov.toFixed(6),
      width,
      height,
    ].join('|');
  }

  private async getCutoutFromCache(cacheKey: string): Promise<{ buffer: Buffer; source: 'memory' | 'redis' } | null> {
    const entry = this.cutoutCache.get(cacheKey);
    if (!entry) {
      const redisBuffer = await this.getRedisBuffer(cacheKey);
      if (!redisBuffer) {
        return null;
      }
      this.setInMemoryCutoutCache(cacheKey, redisBuffer);
      return { buffer: redisBuffer, source: 'redis' };
    }

    if (entry.expiresAt <= Date.now()) {
      this.cutoutCache.delete(cacheKey);
      return null;
    }

    return { buffer: entry.buffer, source: 'memory' };
  }

  private async setCutoutCache(cacheKey: string, buffer: Buffer): Promise<void> {
    const ttlMs = this.cutoutCacheTtlMs();
    this.setInMemoryCutoutCache(cacheKey, buffer);
    await this.setRedisBuffer(cacheKey, buffer, ttlMs);
  }

  private setInMemoryCutoutCache(cacheKey: string, buffer: Buffer): void {
    const ttlMs = Number(process.env['CUTOUT_CACHE_TTL_MS'] || 300_000);
    this.cutoutCache.set(cacheKey, {
      expiresAt: Date.now() + ttlMs,
      buffer,
    });

    if (this.cutoutCache.size > 64) {
      const oldestKey = this.cutoutCache.keys().next().value as string | undefined;
      if (oldestKey) {
        this.cutoutCache.delete(oldestKey);
      }
    }
  }

  private nearbyLabelsCacheKey(ra: number, dec: number, radius: number, limit: number): string {
    return ['nearby', ra.toFixed(5), dec.toFixed(5), radius.toFixed(5), limit].join('|');
  }

  private nearbyLabelsCacheTtlMs(): number {
    return Number(process.env['NEARBY_LABELS_CACHE_TTL_MS'] || 30_000);
  }

  private cutoutCacheTtlMs(): number {
    return Number(process.env['CUTOUT_CACHE_TTL_MS'] || 300_000);
  }

  private async getNearbyLabelsFromCache(
    cacheKey: string,
  ): Promise<{ labels: NearbyCatalogLabel[]; source: 'memory' | 'redis' } | null> {
    const local = this.nearbyLabelsCache.get(cacheKey);
    if (local && local.expiresAt > Date.now()) {
      return { labels: local.labels, source: 'memory' };
    }
    if (local) {
      this.nearbyLabelsCache.delete(cacheKey);
    }

    const redisValue = await this.getRedisJson<NearbyCatalogLabel[]>(cacheKey);
    if (!Array.isArray(redisValue)) {
      return null;
    }

    this.nearbyLabelsCache.set(cacheKey, {
      expiresAt: Date.now() + this.nearbyLabelsCacheTtlMs(),
      labels: redisValue,
    });
    return { labels: redisValue, source: 'redis' };
  }

  private async setNearbyLabelsCache(cacheKey: string, labels: NearbyCatalogLabel[]): Promise<void> {
    const ttlMs = this.nearbyLabelsCacheTtlMs();
    this.nearbyLabelsCache.set(cacheKey, {
      expiresAt: Date.now() + ttlMs,
      labels,
    });
    await this.setRedisJson(cacheKey, labels, ttlMs);
  }

  private async initializeRedisCache(): Promise<void> {
    const enabled = (process.env['REDIS_CACHE_ENABLED'] ?? 'false').toLowerCase() === 'true';
    if (!enabled) {
      this.redisEnabled = false;
      return;
    }

    const host = process.env['REDIS_HOST'] ?? '127.0.0.1';
    const port = Number(process.env['REDIS_PORT'] ?? 6379);
    const password = process.env['REDIS_PASSWORD']?.trim() || undefined;
    const connectTimeout = Number(process.env['REDIS_CONNECT_TIMEOUT_MS'] ?? 2_000);
    const redisTlsEnabled = (process.env['REDIS_TLS_ENABLED'] ?? 'false').toLowerCase() === 'true';
    const redisTlsRejectUnauthorized =
      (process.env['REDIS_TLS_REJECT_UNAUTHORIZED'] ?? 'true').toLowerCase() !== 'false';

    if ((process.env['NODE_ENV'] === 'production' || process.env['REDIS_REQUIRE_PASSWORD'] === 'true') && !password) {
      this.logger.warn('Redis cache disabled: REDIS_PASSWORD is required for secure Redis connections.');
      this.redisEnabled = false;
      return;
    }

    const client = new Redis({
      host,
      port,
      password,
      lazyConnect: true,
      connectTimeout,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      tls: redisTlsEnabled
        ? {
            rejectUnauthorized: redisTlsRejectUnauthorized,
          }
        : undefined,
    });

    try {
      await client.connect();
      await client.ping();
      this.redisClient = client;
      this.redisEnabled = true;
      this.logger.log(`Redis cache enabled at ${host}:${port}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown redis error';
      this.logger.warn(`Redis cache unavailable (${message}). Falling back to in-memory cache.`);
      client.disconnect();
      this.redisClient = null;
      this.redisEnabled = false;
    }
  }

  private logCacheConfiguration(): void {
    const cutoutTtlMs = this.cutoutCacheTtlMs();
    const nearbyTtlMs = this.nearbyLabelsCacheTtlMs();
    const warmupEnabled = (process.env['VIEWER_CACHE_WARMUP_ENABLED'] ?? 'false').toLowerCase() === 'true';
    this.logger.log(
      `Viewer cache config: redis_enabled=${this.redisEnabled}, cutout_ttl_ms=${cutoutTtlMs}, nearby_ttl_ms=${nearbyTtlMs}, warmup_enabled=${warmupEnabled}.`,
    );
  }

  private logCutoutCacheEvent(
    source: 'memory' | 'redis' | 'none',
    provider: 'primary' | 'secondary',
    survey: string,
    width: number,
    height: number,
  ): void {
    this.logger.log(
      `Cutout cache ${source === 'none' ? 'miss' : 'hit'} (source=${source}, provider=${provider}, survey=${survey}, size=${width}x${height}).`,
    );
  }

  private logNearbyCacheEvent(
    result: 'hit' | 'miss',
    source: 'memory' | 'redis' | 'none',
    limit: number,
    radiusDeg: number,
  ): void {
    this.logger.log(`Nearby-label cache ${result} (source=${source}, limit=${limit}, radius_deg=${radiusDeg}).`);
  }

  private scheduleWarmupIfEnabled(): void {
    const enabled = (process.env['VIEWER_CACHE_WARMUP_ENABLED'] ?? 'false').toLowerCase() === 'true';
    if (!enabled) {
      return;
    }

    setTimeout(() => {
      void this.warmViewerCaches();
    }, 50);
  }

  private async warmViewerCaches(): Promise<void> {
    const ra = Number(process.env['VIEWER_WARMUP_RA'] ?? 187.25);
    const dec = Number(process.env['VIEWER_WARMUP_DEC'] ?? 2.05);
    const fov = Number(process.env['VIEWER_WARMUP_FOV'] ?? 1.5);
    const survey = process.env['VIEWER_WARMUP_SURVEY'] ?? 'VLASS';

    try {
      await this.getNearbyLabels(ra, dec, Math.max(0.02, Math.min(0.2, fov * 0.15)), 12);
      const fallbackSurveys = this.cutoutSurveyFallbacks(survey);
      await this.fetchCutoutWithRetries({
        request: { ra, dec, fov, survey, label: 'warmup', detail: 'standard' },
        fallbackSurveys,
        maxAttempts: 2,
        width: 1024,
        height: 1024,
      });
      this.logger.log('Viewer cache warmup completed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown warmup error';
      this.logger.warn(`Viewer cache warmup failed (${message}).`);
    }
  }

  private redisKey(rawKey: string): string {
    return `viewer:${rawKey}`;
  }

  private async getRedisBuffer(rawKey: string): Promise<Buffer | null> {
    if (!this.redisEnabled || !this.redisClient) {
      return null;
    }

    try {
      const value = await this.redisClient.getBuffer(this.redisKey(rawKey));
      if (!value) {
        this.logRedis('redis_miss', { key: rawKey });
        return null;
      }
      this.logRedis('redis_hit', { key: rawKey, bytes: value.length });
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown redis error';
      this.logger.warn(`Redis buffer get failed (${message}); disabling redis cache.`);
      this.redisEnabled = false;
      this.logRedis('redis_error', { key: rawKey, message });
      return null;
    }
  }

  private async setRedisBuffer(rawKey: string, value: Buffer, ttlMs: number): Promise<void> {
    if (!this.redisEnabled || !this.redisClient) {
      return;
    }

    try {
      await this.redisClient.set(this.redisKey(rawKey), value, 'PX', ttlMs);
      this.logRedis('redis_set', { key: rawKey, bytes: value.length, ttl_ms: ttlMs });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown redis error';
      this.logger.warn(`Redis buffer set failed (${message}); disabling redis cache.`);
      this.redisEnabled = false;
      this.logRedis('redis_error', { key: rawKey, message });
    }
  }

  private async getRedisJson<T>(rawKey: string): Promise<T | null> {
    if (!this.redisEnabled || !this.redisClient) {
      return null;
    }

    try {
      const raw = await this.redisClient.get(this.redisKey(rawKey));
      if (!raw) {
        this.logRedis('redis_miss', { key: rawKey });
        return null;
      }
      this.logRedis('redis_hit', { key: rawKey, bytes: raw.length });
      return JSON.parse(raw) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown redis error';
      this.logger.warn(`Redis json get failed (${message}); disabling redis cache.`);
      this.redisEnabled = false;
      this.logRedis('redis_error', { key: rawKey, message });
      return null;
    }
  }

  private async setRedisJson(rawKey: string, value: unknown, ttlMs: number): Promise<void> {
    if (!this.redisEnabled || !this.redisClient) {
      return;
    }

    try {
      await this.redisClient.set(this.redisKey(rawKey), JSON.stringify(value), 'PX', ttlMs);
      this.logRedis('redis_set', { key: rawKey, ttl_ms: ttlMs });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown redis error';
      this.logger.warn(`Redis json set failed (${message}); disabling redis cache.`);
      this.redisEnabled = false;
      this.logRedis('redis_error', { key: rawKey, message });
    }
  }

  private logRedis(event: string, details: Record<string, string | number | boolean | null>): void {
    const payload = { event, correlation_id: '272762e810cea2de53a2f', ...details };
    this.logger.log(JSON.stringify(payload));
    void this.loggingService.add({
      type: 'redis',
      severity: event === 'redis_error' ? 'warn' : 'info',
      message: event,
      data: payload,
    });
  }

  private markCutoutSuccess(provider: 'primary' | 'secondary'): void {
    this.cutoutTelemetry.successTotal += 1;
    if (provider === 'secondary') {
      this.cutoutTelemetry.secondarySuccessTotal += 1;
    } else {
      this.cutoutTelemetry.primarySuccessTotal += 1;
    }
    this.cutoutTelemetry.consecutiveFailures = 0;
    this.cutoutTelemetry.lastSuccessAt = new Date().toISOString();
  }

  private markCutoutFailure(error: unknown): void {
    const reason = this.sanitizeFailureReason(
      error instanceof ServiceUnavailableException
        ? String(error.message)
        : error instanceof Error
          ? error.message
          : 'unknown cutout failure',
    );
    const at = new Date().toISOString();

    this.cutoutTelemetry.failureTotal += 1;
    this.cutoutTelemetry.consecutiveFailures += 1;
    this.cutoutTelemetry.lastFailureAt = at;
    this.cutoutTelemetry.lastFailureReason = reason;
    this.cutoutTelemetry.recentFailures = [{ at, reason }, ...this.cutoutTelemetry.recentFailures].slice(0, 20);
  }

  private sanitizeFailureReason(reason: string): string {
    const redacted = reason
      .replace(/(api[_-]?key=)[^&\s]+/gi, '$1[REDACTED]')
      .replace(/(token=)[^&\s]+/gi, '$1[REDACTED]')
      .replace(/(authorization:\s*bearer\s+)[^\s]+/gi, '$1[REDACTED]');
    return redacted.slice(0, 240);
  }

  private async generateShortId(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const shortId = this.randomBase62(8);
      const existing = await this.viewerStateRepository.findOne({ where: { short_id: shortId } });
      if (!existing) {
        return shortId;
      }
    }

    throw new BadRequestException('Could not generate a unique viewer short ID.');
  }

  private randomBase62(length: number): string {
    const bytes = randomBytes(length);
    let out = '';

    for (let i = 0; i < length; i += 1) {
      out += BASE62_ALPHABET[bytes[i] % BASE62_ALPHABET.length];
    }

    return out;
  }

  private async ensureViewerTables(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS viewer_states (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        short_id VARCHAR(16) UNIQUE NOT NULL,
        encoded_state TEXT NOT NULL,
        state_json JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_viewer_states_short_id ON viewer_states(short_id);
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS viewer_snapshots (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        file_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(64) NOT NULL DEFAULT 'image/png',
        size_bytes INTEGER NOT NULL,
        short_id VARCHAR(16) NULL,
        state_json JSONB NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_viewer_snapshots_short_id ON viewer_snapshots(short_id);
    `);
  }

  private resolveApiRootDir(): string {
    const normalizedCwd = process.cwd().replace(/\\/g, '/');
    if (normalizedCwd.endsWith('/apps/vlass-api')) {
      return process.cwd();
    }
    return resolve(process.cwd(), 'apps', 'vlass-api');
  }
}
