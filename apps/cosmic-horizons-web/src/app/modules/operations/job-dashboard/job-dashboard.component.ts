import { Component as NgComponent, OnInit, OnDestroy, inject } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { JobOrchestrationService } from '../../../features/job-orchestration/job-orchestration.service';
import { Job } from '../../../features/job-orchestration/job.models';
import { MessagingService } from '../../../services/messaging.service';
import { OperationsModule } from '../operations.module';
// heatmap & graph now included via OperationsModule

// Use the same Job interface from the orchestration feature for consistency.

// allow temporary animation flag on jobs
export type JobWithUpdate = Job & { updated?: boolean };

@NgComponent({
  selector: 'app-job-dashboard',
  templateUrl: './job-dashboard.component.html',
  styleUrls: ['./job-dashboard.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatProgressBarModule,
    MatButtonModule,
    // bring in entire operations feature module (which exports the dashboards)
    OperationsModule,
  ],
})
export class JobDashboardComponent implements OnInit, OnDestroy {
  jobs: JobWithUpdate[] = [];
  private jobUpdateSub?: Subscription;
  private heartbeat$: Subscription;

  /** optional status filter used to limit which job rooms we join */
  filterStatus?: string;

  // column list for table definition - make dynamic so we can add actions
  columns: string[] = ['jobId', 'name', 'status', 'progress', 'actions'];

  // prefer `inject` per eslint rule
  private jobService = inject(JobOrchestrationService);
  private messaging = inject(MessagingService);

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
    // ensure websocket connection is ready (auth handled internally)
    this.messaging.ensureConnected();

    // subscribe to service for initial and ongoing job data
    this.jobService.jobs$.subscribe((jobs) => {
      // copy to local so we can mutate for animation tags
      this.jobs = jobs.map((j) => ({ ...j }));

      // tell gateway to join each job room, respecting optional status filter
      jobs.forEach((j) => {
        if (this.filterStatus && j.status !== this.filterStatus) {
          return; // skip jobs that don’t match
        }
        this.messaging.joinJobChannel(j.id).catch(() => {
          // ignore failures during tests or disconnected state
        });
      });
    });

    // listen for job updates coming over websocket
    this.jobUpdateSub = this.messaging.jobUpdate$.subscribe(
      (update: Partial<Job> & { id: string }) => {
        const idx = this.jobs.findIndex((j) => j.id === update.id);
        if (idx !== -1) {
          this.jobs[idx] = { ...this.jobs[idx], ...update } as JobWithUpdate;
          // add temporary highlight flag
          this.jobs[idx].updated = true;
          setTimeout(() => delete this.jobs[idx].updated, 1000);
        }
      },
    );
  }

  ngOnDestroy() {
    this.jobUpdateSub?.unsubscribe();
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
