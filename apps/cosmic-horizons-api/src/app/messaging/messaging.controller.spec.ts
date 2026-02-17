import { Test, TestingModule } from '@nestjs/testing';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { MessagingMonitorService } from './messaging-monitor.service';
import { MessagingStatsService } from './messaging-stats.service';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('MessagingController', () => {
  let controller: MessagingController;
  let service: MessagingService;

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [
        {
          provide: MessagingService,
          useValue: {
            getSites: jest.fn().mockReturnValue([{ id: 'site-1', name: 'Socorro' }]),
            getAllElements: jest.fn().mockReturnValue([{ id: 'element-1', name: 'Dish-1' }]),
            getElementsBySite: jest.fn().mockReturnValue([{ id: 'element-1', name: 'Dish-1', siteId: 'site-1' }]),
          },
        },
        {
          provide: MessagingMonitorService,
          useValue: {
            getSnapshot: jest.fn().mockReturnValue({
              rabbitmq: { connected: true, latencyMs: 1, queueDepth: 0, consumers: 1 },
              kafka: { connected: true, latencyMs: 1, latestOffset: 10, partitions: 1 },
              storage: {
                postgres: { connected: true, latencyMs: 1 },
                redis: { connected: true, latencyMs: 1 },
              },
            }),
          },
        },
        {
          provide: MessagingStatsService,
          useValue: {
            getSnapshot: jest.fn().mockReturnValue({
              at: '2026-01-01T00:00:00.000Z',
              packetsPerSecond: 100,
              nodeToHubPerSecond: 80,
              hubToHubPerSecond: 20,
              rabbitPublishedPerSecond: 100,
              kafkaPublishedPerSecond: 100,
              persistentWritesPerSecond: 1,
              totals: {
                packets: 1000,
                nodeToHub: 800,
                hubToHub: 200,
                rabbitPublished: 1000,
                kafkaPublished: 1000,
                persistentWrites: 20,
                errors: 0,
              },
              infra: {
                rabbitmq: { connected: true, latencyMs: 1, queueDepth: 0, consumers: 1 },
                kafka: { connected: true, latencyMs: 1, latestOffset: 10, partitions: 1 },
                storage: {
                  postgres: { connected: true, latencyMs: 1 },
                  redis: { connected: true, latencyMs: 1 },
                },
              },
            }),
          },
        },
      ],
    }).compile();

    controller = testingModule.get<MessagingController>(MessagingController);
    service = testingModule.get<MessagingService>(MessagingService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return sites', () => {
    expect(controller.getSites()).toEqual([{ id: 'site-1', name: 'Socorro' }]);
    expect(service.getSites).toHaveBeenCalled();
  });

  it('should return all elements', () => {
    expect(controller.getAllElements()).toEqual([{ id: 'element-1', name: 'Dish-1' }]);
    expect(service.getAllElements).toHaveBeenCalled();
  });

  it('should return elements by site', () => {
    expect(controller.getElementsBySite('site-1')).toEqual([{ id: 'element-1', name: 'Dish-1', siteId: 'site-1' }]);
    expect(service.getElementsBySite).toHaveBeenCalledWith('site-1');
  });

  it('should return live stats', () => {
    expect(controller.getLiveStats().packetsPerSecond).toBe(100);
  });
});
