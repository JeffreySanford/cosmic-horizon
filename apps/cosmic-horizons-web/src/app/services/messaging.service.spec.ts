import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MessagingService } from './messaging.service';

describe('MessagingService', () => {
  let service: MessagingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MessagingService]
    });
    service = TestBed.inject(MessagingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeDefined();
  });

  it('should fetch sites', () => {
    const mockSites = [{ id: 'site-1', name: 'Socorro' }];
    service.getSites().subscribe(sites => {
      expect(sites).toEqual(mockSites as any);
    });

    const req = httpMock.expectOne('/api/messaging/sites');
    expect(req.request.method).toBe('GET');
    req.flush(mockSites);
  });

  it('should fetch elements', () => {
    const mockElements = [{ id: 'element-1', name: 'Dish-1' }];
    service.getAllElements().subscribe(elements => {
      expect(elements).toEqual(mockElements as any);
    });

    const req = httpMock.expectOne('/api/messaging/elements');
    expect(req.request.method).toBe('GET');
    req.flush(mockElements);
  });
});
