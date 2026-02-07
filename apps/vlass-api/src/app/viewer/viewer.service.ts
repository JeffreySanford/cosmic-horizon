import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ViewerState } from '../entities/viewer-state.entity';
import { ViewerSnapshot } from '../entities/viewer-snapshot.entity';
import { AuditAction, AuditEntityType } from '../entities/audit-log.entity';
import { AuditLogRepository } from '../repositories';
import { CreateViewerSnapshotDto } from './dto/create-viewer-snapshot.dto';
import { ViewerStatePayload } from './dto/create-viewer-state.dto';
import { ViewerCutoutRequest } from './dto/viewer-cutout.dto';

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

interface CutoutCacheEntry {
  expiresAt: number;
  buffer: Buffer;
}

@Injectable()
export class ViewerService implements OnModuleInit {
  private readonly logger = new Logger(ViewerService.name);
  private readonly cutoutCache = new Map<string, CutoutCacheEntry>();

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ViewerState)
    private readonly viewerStateRepository: Repository<ViewerState>,
    @InjectRepository(ViewerSnapshot)
    private readonly viewerSnapshotRepository: Repository<ViewerSnapshot>,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureViewerTables();
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
    const storageDir = resolve(process.cwd(), 'apps', 'vlass-api', 'storage', 'snapshots');

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

  async downloadCutout(request: ViewerCutoutRequest): Promise<{ buffer: Buffer; fileName: string }> {
    this.validateState({
      ra: request.ra,
      dec: request.dec,
      fov: request.fov,
      survey: request.survey,
      labels: [],
    });

    const fallbackSurveys = this.cutoutSurveyFallbacks(request.survey);
    const maxAttempts = 2;
    const detail = request.detail ?? 'standard';
    const dimensions = this.cutoutDimensions(detail);

    const buffer = await this.fetchCutoutWithRetries({
      request,
      fallbackSurveys,
      maxAttempts,
      width: dimensions.width,
      height: dimensions.height,
    });

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
        ra: request.ra,
        dec: request.dec,
        fov: request.fov,
        size_bytes: buffer.length,
      },
    });

    return {
      buffer,
      fileName: `${fileNameStem}.fits`,
    };
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
  }): Promise<Buffer> {
    let lastErrorMessage = 'no response from provider';

    for (const survey of params.fallbackSurveys) {
      for (let attempt = 1; attempt <= params.maxAttempts; attempt += 1) {
        try {
          const cacheKey = this.cutoutCacheKey(params.request, survey, params.width, params.height);
          const cached = this.getCutoutFromCache(cacheKey);
          if (cached) {
            return cached;
          }

          const cutoutUrl = new URL('https://alasky.cds.unistra.fr/hips-image-services/hips2fits');
          cutoutUrl.searchParams.set('hips', survey);
          cutoutUrl.searchParams.set('format', 'fits');
          cutoutUrl.searchParams.set('projection', 'TAN');
          cutoutUrl.searchParams.set('ra', params.request.ra.toString());
          cutoutUrl.searchParams.set('dec', params.request.dec.toString());
          cutoutUrl.searchParams.set('fov', this.degToRad(params.request.fov).toString());
          cutoutUrl.searchParams.set('width', params.width.toString());
          cutoutUrl.searchParams.set('height', params.height.toString());

          const controller = new AbortController();
          const timeoutHandle = setTimeout(() => controller.abort(), 12_000);
          const response = await fetch(cutoutUrl, {
            headers: {
              Accept: 'application/fits, application/octet-stream;q=0.9',
            },
            signal: controller.signal,
          }).finally(() => clearTimeout(timeoutHandle));

          if (!response.ok) {
            lastErrorMessage = `status ${response.status}`;
            this.logger.warn(`Cutout fetch failed (${survey}, attempt ${attempt}): ${lastErrorMessage}`);
            continue;
          }

          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          if (buffer.length === 0) {
            lastErrorMessage = 'empty payload';
            this.logger.warn(`Cutout fetch failed (${survey}, attempt ${attempt}): ${lastErrorMessage}`);
            continue;
          }

          this.setCutoutCache(cacheKey, buffer);
          return buffer;
        } catch (error) {
          lastErrorMessage = error instanceof Error ? error.message : 'unknown fetch error';
          this.logger.warn(`Cutout fetch failed (${survey}, attempt ${attempt}): ${lastErrorMessage}`);
        }
      }
    }

    throw new ServiceUnavailableException(
      `Science cutout provider is temporarily unavailable (${lastErrorMessage}). Try again or use a wider field.`,
    );
  }

  private degToRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  private cutoutDimensions(detail: 'standard' | 'high' | 'max'): { width: number; height: number } {
    if (detail === 'max') {
      return { width: 3072, height: 3072 };
    }
    if (detail === 'high') {
      return { width: 2048, height: 2048 };
    }

    return { width: 1024, height: 1024 };
  }

  private cutoutCacheKey(request: ViewerCutoutRequest, survey: string, width: number, height: number): string {
    return [
      survey,
      request.ra.toFixed(6),
      request.dec.toFixed(6),
      request.fov.toFixed(6),
      width,
      height,
    ].join('|');
  }

  private getCutoutFromCache(cacheKey: string): Buffer | null {
    const entry = this.cutoutCache.get(cacheKey);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.cutoutCache.delete(cacheKey);
      return null;
    }

    return entry.buffer;
  }

  private setCutoutCache(cacheKey: string, buffer: Buffer): void {
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
}
