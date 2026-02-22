import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dataset } from '../entities/dataset.entity';
import * as fs from 'fs';
// path import previously included but not used; removed to silence lint

@Injectable()
export class DatasetCatalogService {
  private readonly logger = new Logger(DatasetCatalogService.name);

  constructor(
    @InjectRepository(Dataset)
    private readonly repo: Repository<Dataset>,
  ) {}

  async list(): Promise<Dataset[]> {
    return this.repo.find();
  }

  /**
   * Scan the configured ASTRO_DATA_DIR and upsert dataset records.
   * Returns the current contents of the table after refresh.
   */
  async refresh(): Promise<Dataset[]> {
    const dir = process.env.ASTRO_DATA_DIR || '/data';
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

    for (const ent of entries) {
      if (!ent.isDirectory()) {
        continue;
      }
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
    await this.repo
      .createQueryBuilder()
      .delete()
      .where('id NOT IN (:...ids)', { ids: Array.from(seen) })
      .execute();

    return this.repo.find();
  }
}
