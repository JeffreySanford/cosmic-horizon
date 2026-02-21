import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  Job,
  JobSubmissionRequest,
  JobSubmissionResponse,
  Agent,
} from './job.models';

@Injectable({
  providedIn: 'root',
})
export class JobOrchestrationService {
  private jobsSubject = new BehaviorSubject<Job[]>([]);
  public jobs$ = this.jobsSubject.asObservable();

  private mockJobs: Job[] = [];

  constructor() {
    this.loadMockData();
    // Poll for job updates every 5 seconds
    this.startJobPolling();
  }

  /**
   * Load mock agents for MVP
   */
  getAgents(): Observable<Agent[]> {
    return new Observable((observer) => {
      const mockAgents: Agent[] = [
        {
          id: 'alphacal-001',
          name: 'AlphaCal',
          description:
            'Autonomous interferometric calibration with direction-dependent effects',
          version: '2.1.0',
          requiredResources: {
            cpu: 32,
            memory: 128,
            gpu: 2,
          },
        },
        {
          id: 'reconstruction-001',
          name: 'Radio Image Reconstruction',
          description:
            'GPU-accelerated reconstruction for billions of visibilities',
          version: '3.0.2',
          requiredResources: {
            cpu: 64,
            memory: 256,
            gpu: 4,
          },
        },
        {
          id: 'anomaly-001',
          name: 'Anomaly Detection',
          description:
            'Transfer-learning models for events and calibration anomalies',
          version: '1.5.1',
          requiredResources: {
            cpu: 16,
            memory: 64,
            gpu: 1,
          },
        },
      ];
      observer.next(mockAgents);
      observer.complete();
    });
  }

  /**
   * Submit a new job
   */
  submitJob(request: JobSubmissionRequest): Observable<JobSubmissionResponse> {
    return new Observable((observer) => {
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const agent = this.getAgentName(request.agentId);

      const newJob: Job = {
        id: jobId,
        name: request.name,
        agentId: request.agentId,
        agentName: agent,
        status: 'queued',
        parameters: request.parameters,
        createdAt: new Date(),
        progress: 0,
        logs: [],
      };

      this.mockJobs.unshift(newJob);
      this.jobsSubject.next([...this.mockJobs]);

      observer.next({
        jobId,
        status: 'queued',
        message: `Job submitted successfully. ID: ${jobId}`,
      });
      observer.complete();
    });
  }

  /**
   * Get all jobs
   */
  getJobs(): Observable<Job[]> {
    return this.jobs$;
  }

  /**
   * Get job by ID
   */
  getJobById(jobId: string): Observable<Job | undefined> {
    return this.jobs$.pipe(map((jobs) => jobs.find((job) => job.id === jobId)));
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): Observable<void> {
    return new Observable((observer) => {
      const job = this.mockJobs.find((j) => j.id === jobId);
      if (job && (job.status === 'queued' || job.status === 'running')) {
        job.status = 'cancelled';
        job.cancelledAt = new Date();
        this.jobsSubject.next([...this.mockJobs]);
      }
      observer.next();
      observer.complete();
    });
  }

  /**
   * Apply an incoming websocket/update partial to existing job list.
   * Useful when dashboard receives events from server or mocks.
   */
  applyJobUpdate(update: Partial<Job> & { id: string }) {
    const idx = this.mockJobs.findIndex((j) => j.id === update.id);
    if (idx !== -1) {
      this.mockJobs[idx] = { ...this.mockJobs[idx], ...update } as Job;
      this.jobsSubject.next([...this.mockJobs]);
    }
  }

  /**
   * Start job polling for real-time updates
   */
  private startJobPolling(): void {
    // simply run simulation on a fixed timer; we don't need to react to
    // the jobs$ observable itself, which would cause the recursive loop
    // where simulateJobProgress emits and triggers the subscription again.
    interval(5000).subscribe(() => {
      this.simulateJobProgress();
    });
  }

  /**
   * Simulate job progress for MVP
   */
  private simulateJobProgress(): void {
    for (const job of this.mockJobs) {
      if (job.status === 'queued' && Math.random() > 0.7) {
        job.status = 'running';
        job.startedAt = new Date();
        job.progress = 5;
      } else if (job.status === 'running') {
        job.progress = Math.min(job.progress + Math.random() * 15, 99);
        job.estimatedTimeRemaining = Math.max(
          0,
          3600 - (Date.now() - (job.startedAt?.getTime() || 0)) / 1000,
        );

        if (Math.random() > 0.95) {
          job.status = 'completed';
          job.completedAt = new Date();
          job.progress = 100;
          job.outputPath = `/results/${job.id}`;
        }
      }
    }
    this.jobsSubject.next([...this.mockJobs]);
  }

  /**
   * Load mock data for MVP
   */
  private loadMockData(): void {
    this.mockJobs = [];
    this.jobsSubject.next([...this.mockJobs]);
  }

  /**
   * Get agent name from ID
   */
  private getAgentName(agentId: string): string {
    const agentMap: { [key: string]: string } = {
      'alphacal-001': 'AlphaCal',
      'reconstruction-001': 'Radio Image Reconstruction',
      'anomaly-001': 'Anomaly Detection',
    };
    return agentMap[agentId] || 'Unknown Agent';
  }
}
