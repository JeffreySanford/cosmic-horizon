import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AladinService {
  private readonly logger = new Logger(AladinService.name);
  private instances: Map<string, any> = new Map();
  private catalogs: Map<string, any[]> = new Map();
  private overlays: Map<string, Set<string>> = new Map();
  private instanceCounter = 0;

  constructor(private configService: ConfigService) {}

  async initializeAladin(elementId: string, config?: any): Promise<string> {
    const instanceId = `aladin-${Date.now()}-${this.instanceCounter++}`;
    this.instances.set(instanceId, {
      id: instanceId,
      elementId,
      config: config || {},
      layers: [],
      createdAt: new Date(),
      viewState: { ra: 0, dec: 0, fov: 60 },
    });
    this.logger.log(`Aladin instance ${instanceId} initialized on ${elementId}`);
    return instanceId;
  }

  async setView(instanceId: string, ra: number, dec: number, fov: number): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance) instance.viewState = { ra, dec, fov };
  }

  async addCatalog(instanceId: string, catalogUrl: string, catalogName: string): Promise<void> {
    if (!this.catalogs.has(instanceId)) this.catalogs.set(instanceId, []);
    this.catalogs.get(instanceId)!.push({ name: catalogName, url: catalogUrl, addedAt: new Date() });
  }

  async removeCatalog(instanceId: string, catalogName: string): Promise<void> {
    const cats = this.catalogs.get(instanceId);
    if (cats) {
      this.catalogs.set(instanceId, cats.filter(c => c.name !== catalogName));
    }
  }

  async getMetrics(): any {
    let totalCatalogs = 0;
    this.catalogs.forEach((cats) => totalCatalogs += cats.length);
    return {
      instances: this.instances.size,
      catalogs: totalCatalogs,
      overlays: this.overlays.size,
    };
  }
}
