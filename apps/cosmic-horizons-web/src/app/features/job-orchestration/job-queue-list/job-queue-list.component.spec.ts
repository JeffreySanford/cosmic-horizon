import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobQueueListComponent } from './job-queue-list.component';
import { JobOrchestrationModule } from '../job-orchestration.module';
import { JobOrchestrationService } from '../job-orchestration.service';
import { Job } from '../job.models';
import { of, firstValueFrom } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('JobQueueListComponent', () => {
  let component: JobQueueListComponent;
  let fixture: ComponentFixture<JobQueueListComponent>;
  let mockJobService: any;

  const mockJobs: Job[] = [
    {
      id: 'job-1',
      name: 'Test Job 1',
      agentId: 'alphacal-001',
      agentName: 'AlphaCal',
      status: 'running',
      parameters: {},
      createdAt: new Date(),
      progress: 50,
    },
    {
      id: 'job-2',
      name: 'Test Job 2',
      agentId: 'reconstruction-001',
      agentName: 'Radio Image Reconstruction',
      status: 'completed',
      parameters: {},
      createdAt: new Date(),
      completedAt: new Date(),
      progress: 100,
    },
  ];

  beforeEach(async () => {
    mockJobService = {
      getJobs: vi.fn().mockReturnValue(of(mockJobs)),
      cancelJob: vi.fn().mockReturnValue(of(void 0)),
    };

    await TestBed.configureTestingModule({
      imports: [JobOrchestrationModule],
      providers: [
        { provide: JobOrchestrationService, useValue: mockJobService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(JobQueueListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load jobs on init', async () => {
    const jobs = await firstValueFrom(component.filteredJobs$);
    expect(jobs.length).toBeGreaterThan(0);
  });

  it('should filter jobs by status', async () => {
    component.selectedStatus = 'running';
    component.ngOnChanges();

    const jobs = await firstValueFrom(component.filteredJobs$);
    expect(jobs.every(job => job.status === 'running')).toBe(true);
  });

  it('should return correct status color', () => {
    expect(component.getStatusColor('running')).toBe('#3fb950');
    expect(component.getStatusColor('completed')).toBe('#238636');
    expect(component.getStatusColor('failed')).toBe('#f85149');
  });

  it('should format time remaining', () => {
    const result = component.formatTimeRemaining(3661);
    expect(result).toContain('1h');
    expect(result).toContain('1m');
  });

  it('should cancel job', () => {
    component.onCancelJob('job-1');
    expect(mockJobService.cancelJob).toHaveBeenCalledWith('job-1');
  });
});
