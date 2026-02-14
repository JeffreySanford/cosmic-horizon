import { Test, TestingModule } from '@nestjs/testing';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

describe('MessagingController', () => {
  let controller: MessagingController;
  let service: MessagingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
      ],
    }).compile();

    controller = module.get<MessagingController>(MessagingController);
    service = module.get<MessagingService>(MessagingService);
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
});
