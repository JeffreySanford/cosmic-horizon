import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dataset } from '../entities/dataset.entity';
import * as fs from 'fs';
import * as path from 'path';
// path import previously included but not used; removed to silence lint

@Injectable()
export class DatasetCatalogService {
  private readonly logger = new Logger(DatasetCatalogService.name);

  constructor(
    @InjectRepository(Dataset)
    private readonly repo: Repository<Dataset>,
  ) {}

  async list(): Promise<Dataset[]> {
    const existing = await this.repo.find();
    if (existing.length > 0) {
      return existing;
    }

    // Auto-refresh when catalog is empty so first page load after reset has data.
    return this.refresh();
  }

  /**
   * Scan the configured ASTRO_DATA_DIR and upsert dataset records.
   * Returns the current contents of the table after refresh.
   */
  async refresh(): Promise<Dataset[]> {
    const dir = this.resolveDataDir();
    this.logger.log(`Refreshing datasets from ${dir}`);
    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (e) {
      this.logger.warn(`could not read astro data dir: ${e}`);
      return this.repo.find();
    }

    const now = new Date();
    const seen = new Set<string>();
    const datasetDirs = entries.filter((ent) => ent.isDirectory());

    if (datasetDirs.length === 0) {
      const fileCount = entries.filter((ent) => ent.isFile()).length;
      if (fileCount > 0) {
        const fallbackId = 'astro-data-root';
        const fallbackLabel = `astro-data root (${fileCount} file${fileCount === 1 ? '' : 's'})`;
        const existing = await this.repo.findOne({ where: { id: fallbackId } });
        const record = existing
          ? Object.assign(existing, { label: fallbackLabel, lastUpdated: now })
          : this.repo.create({
              id: fallbackId,
              label: fallbackLabel,
              lastUpdated: now,
            });
        await this.repo.save(record);
        this.logger.warn(
          `No dataset folders found in ${dir}; using fallback dataset "${fallbackId}".`,
        );
        return this.repo.find();
      }

      this.logger.warn(`No datasets found in ${dir}. Add dataset folders and refresh.`);
      return this.repo.find();
    }

    for (const ent of datasetDirs) {
      const id = ent.name;
      seen.add(id);
      let ds = await this.repo.findOne({ where: { id } });
      if (!ds) {
        ds = this.repo.create({ id, label: id, lastUpdated: now });
      } else {
        ds.lastUpdated = now;
      }
      await this.repo.save(ds);
    }

    // optionally remove records no longer on disk
    if (seen.size > 0) {
      await this.repo
        .createQueryBuilder()
        .delete()
        .where('id NOT IN (:...ids)', { ids: Array.from(seen) })
        .execute();
    }

    return this.repo.find();
  }

  private resolveDataDir(): string {
    const configured = process.env.ASTRO_DATA_DIR;
    const localFallback = path.resolve(process.cwd(), 'astronomy-data');

    if (configured && configured.trim().length > 0) {
      const normalized = configured.trim();
      const configuredExists = fs.existsSync(normalized);
      if (configuredExists) {
        return normalized;
      }

      // Common local-dev case: `/data` works in Docker but not on host Windows/macOS.
      if ((normalized === '/data' || normalized === '\\data') && fs.existsSync(localFallback)) {
        this.logger.warn(
          `ASTRO_DATA_DIR=${normalized} is unavailable on host. Falling back to ${localFallback}`,
        );
        return localFallback;
      }

      return normalized;
    }

    return fs.existsSync(localFallback) ? localFallback : '/data';
  }
}
