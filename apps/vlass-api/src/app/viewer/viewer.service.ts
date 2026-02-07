import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ViewerState } from '../entities/viewer-state.entity';
import { ViewerSnapshot } from '../entities/viewer-snapshot.entity';
import { CreateViewerSnapshotDto } from './dto/create-viewer-snapshot.dto';
import { ViewerStatePayload } from './dto/create-viewer-state.dto';

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

@Injectable()
export class ViewerService implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ViewerState)
    private readonly viewerStateRepository: Repository<ViewerState>,
    @InjectRepository(ViewerSnapshot)
    private readonly viewerSnapshotRepository: Repository<ViewerSnapshot>,
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

    return {
      id: snapshot.id,
      image_url: `/api/view/snapshots/${snapshot.file_name}`,
      short_id: snapshot.short_id,
      size_bytes: snapshot.size_bytes,
      created_at: snapshot.created_at,
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
