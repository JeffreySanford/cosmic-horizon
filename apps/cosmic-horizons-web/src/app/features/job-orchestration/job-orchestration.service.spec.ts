import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { JobOrchestrationService } from './job-orchestration.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import {
  selectAllJobs,
  selectJobCount,
  selectJobsEntities,
} from '../../store/features/jobs/jobs.selectors';
import * as JobsActions from '../../store/features/jobs/jobs.actions';
import { selectMockModeEnabled } from '../../store/features/ui/ui.selectors';

describe('JobOrchestrationService', () => {
  let service: JobOrchestrationService;
  let httpMock: HttpTestingController;
  let store: MockStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [JobOrchestrationService, provideMockStore()],
    });

    store = TestBed.inject(MockStore);
    store.overrideSelector(selectAllJobs, [
      { id: 'foo', name: 'Job Foo', status: 'running' } as any,
    ]);
    store.overrideSelector(selectJobCount, 1);
    store.overrideSelector(selectJobsEntities, {
      foo: { id: 'foo', name: 'Job Foo', status: 'running' } as any,
    });
    store.overrideSelector(selectMockModeEnabled, false);
    store.refreshState();

    service = TestBed.inject(JobOrchestrationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('returns a list of agents', async () => {
    const agents = await firstValueFrom(service.getAgents());
    expect(agents.length).toBe(3);
    expect(agents[0].name).toBe('AlphaCal');
  });

  it('passes through submitJob POST to the server and dispatches request action', async () => {
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    const request = { name: 'Test', agentId: 'a1', parameters: {} };
    service.submitJob(request).subscribe();
    const req = httpMock.expectOne('/api/jobs/submit');
    expect(req.request.method).toBe('POST');
    req.flush({ jobId: 'j1', status: 'queued' });

    expect(dispatchSpy).toHaveBeenCalledWith(
      JobsActions.jobSubmittedRequested({ request }),
    );
  });

  it('returns jobs from store when mock mode is disabled', async () => {
    store.overrideSelector(selectMockModeEnabled, false);
    store.refreshState();
    const jobs = await firstValueFrom(service.getJobs());
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe('foo');
  });

  it('returns empty list immediately when mock mode is active', async () => {
    store.overrideSelector(selectMockModeEnabled, true);
    store.refreshState();
    const jobs = await firstValueFrom(service.getJobs());
    expect(jobs).toEqual([]);
  });

  it('returns job count from selector', async () => {
    const count = await firstValueFrom(service.getJobCount());
    expect(count).toBe(1);
  });

  it('returns job by id from entities selector', async () => {
    const job = await firstValueFrom(service.getJobById('foo'));
    expect(job?.status).toBe('running');
  });

  it('cancels a job with POST /cancel and dispatches request action', () => {
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    service.cancelJob('foo').subscribe();
    const req = httpMock.expectOne('/api/jobs/foo/cancel');
    expect(req.request.method).toBe('POST');
    req.flush({});

    expect(dispatchSpy).toHaveBeenCalledWith(
      JobsActions.jobCancelledRequested({ jobId: 'foo' }),
    );
  });

  it('dispatches job update to store', () => {
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    service.applyJobUpdate({ id: '1', status: 'running' });
    expect(dispatchSpy).toHaveBeenCalledWith(
      JobsActions.jobUpdateReceived({ update: { id: '1', status: 'running' } }),
    );
  });

  it('isPolling returns false when no polling subscription exists', () => {
    expect(service.isPolling()).toBe(false);
  });
});
