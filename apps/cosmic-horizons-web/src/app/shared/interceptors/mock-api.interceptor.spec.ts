import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { MockApiInterceptor } from './mock-api.interceptor';
import { MockModeService } from '../../services/mock-mode.service';

describe('MockApiInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let mode: MockModeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: MockApiInterceptor, multi: true },
        MockModeService,
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    mode = TestBed.inject(MockModeService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('passes through requests when mock mode is disabled', () => {
    mode.disable();
    http.get('/api/jobs').subscribe();
    const req = httpMock.expectOne('/api/jobs');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('returns canned response when mock mode is enabled', async () => {
    mode.enable();
    let response: any;
    http.post('/api/jobs/submit', { name: 'x' }).subscribe((res) => (response = res));
    // interceptor delays by 500ms
    await new Promise((r) => setTimeout(r, 520));
    expect(response?.jobId).toMatch(/JOB-\d+-\d+/);
  });
});
