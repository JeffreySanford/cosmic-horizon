import { Test, TestingModule } from '@nestjs/testing';
import { take } from 'rxjs';
import { MessagingService } from './messaging.service';
import { LoggingService } from '../logging/logging.service';
import { MessagingStatsService } from './messaging-stats.service';

describe('MessagingService', () => {
  let service: MessagingService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        MessagingService,
        {
          provide: LoggingService,
          useValue: {
            add: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MessagingStatsService,
          useValue: {
            recordPacket: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<MessagingService>(MessagingService);
  });

  afterEach(async () => {
    service.onModuleDestroy();
    await moduleRef.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize with 60 elements', () => {
    const elements = service.getAllElements();
    expect(elements.length).toBe(60);
  });

  it('should distribute elements across 5 sites', () => {
    const sites = service.getSites();
    expect(sites.length).toBe(5);
    sites.forEach((site) => {
      const siteElements = service.getElementsBySite(site.id);
      expect(siteElements.length).toBe(12);
    });
  });

  it('should provide aggregate data rates for sites', () => {
    const sites = service.getSites();
    sites.forEach((site) => {
      expect(site.totalDataRateGbps).toBeGreaterThan(0);
      expect(site.activeElements).toBe(12);
    });
  });

  it('should emit telemetry updates', (done) => {
    service.onModuleInit(); // Start simulation
    service.telemetry$.pipe(take(1)).subscribe((packet) => {
      expect(packet.elementId).toBeDefined();
      expect(packet.sourceId).toBeDefined();
      expect(packet.targetId).toBeDefined();
      expect(packet.metrics).toBeDefined();
      done();
    });
  });
});
