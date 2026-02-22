import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { DatasetCatalogService } from './services/dataset-catalog.service';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';

@Controller('datasets')
export class DatasetsController {
  constructor(private readonly catalog: DatasetCatalogService) {}

  /**
   * List all known datasets with metadata
   */
  @Get()
  @UseGuards(AuthenticatedGuard)
  async list() {
    return this.catalog.list();
  }

  /**
   * Refresh the dataset catalog by scanning disk and updating timestamps.
   */
  @Post('refresh')
  @UseGuards(AuthenticatedGuard)
  async refresh() {
    return this.catalog.refresh();
  }
}
