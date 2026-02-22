import { Test, TestingModule } from '@nestjs/testing';
import { DatasetsController } from './datasets.controller';
import { DatasetCatalogService } from './services/dataset-catalog.service';

describe('DatasetsController', () => {
  let controller: DatasetsController;
  let catalog: jest.Mocked<DatasetCatalogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DatasetsController],
      providers: [
        {
          provide: DatasetCatalogService,
          useValue: {
            list: jest.fn(),
            refresh: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DatasetsController>(DatasetsController);
    catalog = module.get(DatasetCatalogService) as jest.Mocked<DatasetCatalogService>;
  });

  it('should list datasets', async () => {
    const fake = [{ id: 'a', label: 'A', lastUpdated: new Date() }];
    catalog.list.mockResolvedValue(fake as any);

    const res = await controller.list();
    expect(res).toBe(fake);
    expect(catalog.list).toHaveBeenCalled();
  });

  it('should refresh datasets', async () => {
    const fake = [{ id: 'b', label: 'B', lastUpdated: new Date() }];
    catalog.refresh.mockResolvedValue(fake as any);

    const res = await controller.refresh();
    expect(res).toBe(fake);
    expect(catalog.refresh).toHaveBeenCalled();
  });
});
