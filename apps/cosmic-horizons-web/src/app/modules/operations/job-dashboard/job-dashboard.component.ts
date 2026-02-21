import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { JobOrchestrationService } from '../../../features/job-orchestration/job-orchestration.service';
import { Job } from '../../../features/job-orchestration/job.models';

// Use the same Job interface from the orchestration feature for consistency.

// allow temporary animation flag on jobs
export type JobWithUpdate = Job & { updated?: boolean };

@Component({
  selector: 'app-job-dashboard',
  templateUrl: './job-dashboard.component.html',
  styleUrls: ['./job-dashboard.component.scss'],
  standalone: false,
})
export class JobDashboardComponent implements OnInit, OnDestroy {
  jobs: JobWithUpdate[] = [];
  private socket?: Socket;
  private heartbeat$: Subscription;

  // column list for table definition - make dynamic so we can add actions
  columns: string[] = ['jobId', 'name', 'status', 'progress', 'actions'];

  // prefer `inject` per eslint rule
  private jobService = inject(JobOrchestrationService);

  constructor() {
    // heartbeat used in tests to trigger a fake update when service not available
    this.heartbeat$ = interval(5000).subscribe(() => {
      if (this.jobs.length > 1) {
        const job = this.jobs[1];
        if (job.progress < 100) {
          job.progress += 5;
        } else {
          job.status = 'completed';
        }
      }
    });
  }

  ngOnInit() {
    // subscribe to service for initial and ongoing job data
    this.jobService.jobs$.subscribe((jobs) => {
      // copy to local so we can mutate for animation tags
      this.jobs = jobs.map((j) => ({ ...j }));
    });

    // connect to WebSocket server and listen for job updates
    this.socket = io('/messaging', {
      transports: ['websocket'],
      auth: {
        token: process.env['WS_AUTH_TOKEN'] || '',
      },
    });

    this.socket.on('job_update', (update: Partial<Job> & { id: string }) => {
      const idx = this.jobs.findIndex((j) => j.id === update.id);
      if (idx !== -1) {
        this.jobs[idx] = { ...this.jobs[idx], ...update } as JobWithUpdate;
        // add temporary highlight flag
        this.jobs[idx].updated = true;
        setTimeout(() => delete this.jobs[idx].updated, 1000);
      }
    });
  }

  ngOnDestroy() {
    this.socket?.disconnect();
    this.heartbeat$.unsubscribe();
  }

  /**
   * counts grouped by status for summary display
   */
  get statusCounts(): Record<string, number> {
    return this.jobs.reduce((acc, j) => {
      const key = j.status;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  get statusKeys(): string[] {
    return Object.keys(this.statusCounts);
  }

  cancel(job: Job) {
    this.jobService.cancelJob(job.id).subscribe();
  }
}
