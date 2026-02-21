import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { JobOrchestrationService } from './job-orchestration.service';
import { MockModeService } from '../../services/mock-mode.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';


describe('JobOrchestrationService', () => {
  let service: JobOrchestrationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [JobOrchestrationService],
    });
    const mockSvc = TestBed.inject(MockModeService);
    mockSvc.disable();
    service = TestBed.inject(JobOrchestrationService);
    httpMock = TestBed.inject(HttpTestingController);
    // constructor issues initial GETs; satisfy them so tests don't error
    // constructor makes one initial GET to load jobs; satisfy it so
    // other tests don't blow up.  We used to also fetch `/api/jobs/count`
    // here, but that call was removed from the service in a refactor.
    const initReq = httpMock.expectOne('/api/jobs');
    initReq.flush([]);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('returns a list of agents', async () => {
    const agents = await firstValueFrom(service.getAgents());
    expect(agents.length).toBe(3);
    expect(agents[0].name).toBe('AlphaCal');
  });

  it('passes through submitJob POST to the server', async () => {
    const request = { name: 'Test', agentId: 'a1', parameters: {} };
    service.submitJob(request).subscribe();
    const req = httpMock.expectOne('/api/jobs/submit');
    expect(req.request.method).toBe('POST');
    req.flush({ jobId: 'j1', status: 'queued' });
  });

  it('fetches jobs via GET /api/jobs', () => {
    service.getJobs().subscribe();
    const req = httpMock.expectOne('/api/jobs');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('returns empty list immediately when mock mode is active', () => {
    const mockSvc = TestBed.inject(MockModeService);
    mockSvc.enable();
    const spy = vi.spyOn(httpMock, 'expectOne');
    service.getJobs().subscribe((jobs) => {
      expect(jobs).toEqual([]);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('fetches job count from /api/jobs/count', async () => {
    const promise = firstValueFrom(service.getJobCount());
    const req = httpMock.expectOne('/api/jobs/count');
    req.flush({ count: 42 });
    const count = await promise;
    expect(count).toBe(42);
  });

  it('gets status for a specific job', async () => {
    const promise = firstValueFrom(service.getJobById('foo'));
    const req = httpMock.expectOne('/api/jobs/foo/status');
    req.flush({ id: 'foo', status: 'running' });
    const job = await promise;
    expect(job?.status).toBe('running');
  });

  it('cancels a job with POST /cancel', () => {
    service.cancelJob('foo').subscribe();
    const req = httpMock.expectOne('/api/jobs/foo/cancel');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('applyJobUpdate merges into current job list', () => {
    service['jobsSubject'].next([{ id: '1', name: 'x', status: 'queued' } as any]);
    service.applyJobUpdate({ id: '1', status: 'running' });
    const jobs = service['jobsSubject'].getValue();
    expect(jobs[0].status).toBe('running');
  });

  it('isPolling returns false when no polling subscription exists', () => {
    expect(service.isPolling()).toBe(false);
  });
});
