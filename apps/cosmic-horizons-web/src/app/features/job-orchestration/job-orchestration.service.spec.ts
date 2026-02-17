import { TestBed } from '@angular/core/testing';
import { JobOrchestrationService } from './job-orchestration.service';
import { describe, it, expect, beforeEach } from 'vitest';
import { firstValueFrom } from 'rxjs';

describe('JobOrchestrationService', () => {
  let service: JobOrchestrationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [JobOrchestrationService],
    });
    service = TestBed.inject(JobOrchestrationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get agents', async () => {
    const agents = await firstValueFrom(service.getAgents());
    expect(agents.length).toBe(3);
    expect(agents[0].name).toBe('AlphaCal');
  });

  it('should submit job', async () => {
    const request = {
      name: 'Test Job',
      agentId: 'alphacal-001',
      parameters: {},
    };

    const response = await firstValueFrom(service.submitJob(request));
    expect(response.jobId).toBeTruthy();
    expect(response.status).toBe('queued');
  });

  it('should retrieve jobs', async () => {
    const jobs = await firstValueFrom(service.getJobs());
    expect(Array.isArray(jobs)).toBe(true);
  });

  it('should cancel job', async () => {
    const request = {
      name: 'Test Job',
      agentId: 'alphacal-001',
      parameters: {},
    };

    const resp = await firstValueFrom(service.submitJob(request));
    await firstValueFrom(service.cancelJob(resp.jobId));
    const job = await firstValueFrom(service.getJobById(resp.jobId));
    expect(job?.status).toBe('cancelled');
  });
});
