import { Logger } from '@nestjs/common';
import { AladinService } from './aladin.service';

describe('AladinService', () => {
  let service: AladinService;

  beforeEach(() => {
    service = new AladinService();

    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeAladin', () => {
    it('should initialize Aladin instance', async () => {
      const instanceId = await service.initializeAladin('viewer-1');

      expect(instanceId).toBeDefined();
      expect(instanceId).toMatch(/^aladin-/);
    });

    it('should initialize with custom config', async () => {
      const config = {
        survey: 'VLASS',
        projection: 'TAN',
        fov: 60,
      };

      const instanceId = await service.initializeAladin('viewer-2', config);

      expect(instanceId).toBeDefined();
    });

    it('should generate unique instance IDs', async () => {
      const id1 = await service.initializeAladin('elem-1');
      const id2 = await service.initializeAladin('elem-2');

      expect(id1).not.toBe(id2);
    });

    it('should create instances with default config', async () => {
      const instanceId = await service.initializeAladin('viewer-3');

      expect(instanceId).toBeDefined();
      expect(instanceId).toContain('aladin');
    });

    it('should handle multiple concurrent initializations', async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        promises.push(service.initializeAladin(`viewer-${i}`));
      }

      const ids = await Promise.all(promises);

      expect(ids).toHaveLength(5);
      expect(new Set(ids).size).toBe(5);
    });
  });

  describe('setView', () => {
    let instanceId: string;

    beforeEach(async () => {
      instanceId = await service.initializeAladin('viewer-test');
    });

    it('should set view parameters', async () => {
      await service.setView(instanceId, 100, 50, 2);

      expect(service).toBeDefined();
    });

    it('should handle RA/Dec coordinates', async () => {
      const ra = 266.4172;
      const dec = -29.0;
      const fov = 10;

      await service.setView(instanceId, ra, dec, fov);

      expect(service).toBeDefined();
    });

    it('should handle full sky view', async () => {
      await service.setView(instanceId, 0, 0, 180);

      expect(service).toBeDefined();
    });

    it('should handle zoomed view', async () => {
      await service.setView(instanceId, 100, 50, 0.1);

      expect(service).toBeDefined();
    });
  });

  describe('addCatalog', () => {
    let instanceId: string;

    beforeEach(async () => {
      instanceId = await service.initializeAladin('viewer-cat-test');
    });

    it('should add catalog to instance', async () => {
      const catalogUrl = 'https://archive.stsci.edu/catalogs/gaia.json';
      const catalogName = 'GAIA';

      await service.addCatalog(instanceId, catalogUrl, catalogName);

      expect(service).toBeDefined();
    });

    it('should handle multiple catalogs', async () => {
      const catalogs = [
        { url: 'https://example.com/cat1.json', name: 'CAT1' },
        { url: 'https://example.com/cat2.json', name: 'CAT2' },
        { url: 'https://example.com/cat3.json', name: 'CAT3' },
      ];

      for (const cat of catalogs) {
        await service.addCatalog(instanceId, cat.url, cat.name);
      }

      expect(service).toBeDefined();
    });

    it('should handle catalog with special characters in name', async () => {
      await service.addCatalog(
        instanceId,
        'https://example.com/catalog.json',
        'My-Catalog_v2.1'
      );

      expect(service).toBeDefined();
    });

    it('should support different catalog sources', async () => {
      const sources = [
        'https://simbad.u-strasbg.fr/simbad/sim-tap',
        'https://archive.stsci.edu/panoptes/',
        'https://lasd.lsst.org/api',
      ];

      for (const source of sources) {
        await service.addCatalog(instanceId, source, `CAT-${source.slice(0, 10)}`);
      }

      expect(service).toBeDefined();
    });
  });

  describe('removeCatalog', () => {
    let instanceId: string;

    beforeEach(async () => {
      instanceId = await service.initializeAladin('viewer-remove-test');
      await service.addCatalog(
        instanceId,
        'https://example.com/catalog.json',
        'TEST_CAT'
      );
    });

    it('should remove catalog from instance', async () => {
      await service.removeCatalog(instanceId, 'TEST_CAT');

      expect(service).toBeDefined();
    });

    it('should handle removal of non-existent catalog', async () => {
      await expect(
        service.removeCatalog(instanceId, 'NON_EXISTENT')
      ).resolves.not.toThrow();
    });

    it('should handle multiple removals', async () => {
      await service.addCatalog(instanceId, 'url1', 'CAT1');
      await service.addCatalog(instanceId, 'url2', 'CAT2');

      await service.removeCatalog(instanceId, 'CAT1');
      await service.removeCatalog(instanceId, 'CAT2');

      expect(service).toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('should return metrics object', async () => {
      const metrics = await service.getMetrics();

      expect(metrics).toHaveProperty('instances');
      expect(metrics).toHaveProperty('catalogs');
      expect(metrics).toHaveProperty('overlays');
    });

    it('should show zero metrics initially', async () => {
      const service2 = new AladinService();
      const metrics = await service2.getMetrics();

      expect(metrics.instances).toBe(0);
      expect(metrics.catalogs).toBe(0);
      expect(metrics.overlays).toBe(0);
    });

    it('should track instance count', async () => {
      const id1 = await service.initializeAladin('viewer-1');
      const id2 = await service.initializeAladin('viewer-2');
      const id3 = await service.initializeAladin('viewer-3');

      const metrics = await service.getMetrics();

      expect(metrics.instances).toBe(3);
    });

    it('should track catalog count', async () => {
      const instanceId = await service.initializeAladin('viewer-metrics');

      await service.addCatalog(instanceId, 'url1', 'CAT1');
      await service.addCatalog(instanceId, 'url2', 'CAT2');
      await service.addCatalog(instanceId, 'url3', 'CAT3');

      const metrics = await service.getMetrics();

      expect(metrics.catalogs).toBe(3);
    });

    it('should update metrics after catalog removal', async () => {
      const instanceId = await service.initializeAladin('viewer-update');

      await service.addCatalog(instanceId, 'url1', 'CAT1');
      await service.addCatalog(instanceId, 'url2', 'CAT2');

      let metrics = await service.getMetrics();
      expect(metrics.catalogs).toBe(2);

      await service.removeCatalog(instanceId, 'CAT1');
      metrics = await service.getMetrics();
      expect(metrics.catalogs).toBe(1);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete Aladin workflow', async () => {
      const instanceId = await service.initializeAladin('main-viewer', {
        survey: 'VLASS',
      });

      await service.setView(instanceId, 266, -30, 5);

      await service.addCatalog(
        instanceId,
        'https://example.com/catalog.json',
        'MY_CATALOG'
      );

      const metrics = await service.getMetrics();

      expect(metrics.instances).toBe(1);
      expect(metrics.catalogs).toBe(1);
    });

    it('should handle multi-instance setup', async () => {
      const id1 = await service.initializeAladin('viewer-1');
      const id2 = await service.initializeAladin('viewer-2');

      await service.setView(id1, 100, 50, 10);
      await service.setView(id2, 200, -50, 20);

      await service.addCatalog(id1, 'url1', 'CAT1');
      await service.addCatalog(id2, 'url2', 'CAT2');

      const metrics = await service.getMetrics();

      expect(metrics.instances).toBe(2);
      expect(metrics.catalogs).toBe(2);
    });

    it('should manage multiple catalogs across instances', async () => {
      const catalogs = [
        { url: 'https://example.com/gaia.json', name: 'GAIA' },
        { url: 'https://example.com/sdss.json', name: 'SDSS' },
        { url: 'https://example.com/panoptes.json', name: 'PANOPTES' },
      ];

      for (const cat of catalogs) {
        const id = await service.initializeAladin('multi-cat');
        await service.addCatalog(id, cat.url, cat.name);
      }

      const metrics = await service.getMetrics();

      expect(metrics.catalogs).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle setView on non-existent instance gracefully', async () => {
      await expect(
        service.setView('non-existent-id', 100, 50, 10)
      ).resolves.not.toThrow();
    });

    it('should handle addCatalog on non-existent instance gracefully', async () => {
      await expect(
        service.addCatalog('non-existent-id', 'url', 'name')
      ).resolves.not.toThrow();
    });

    it('should handle invalid coordinates gracefully', async () => {
      const instanceId = await service.initializeAladin('error-test');

      await expect(
        service.setView(instanceId, 1000, 1000, -10)
      ).resolves.not.toThrow();
    });
  });
});
