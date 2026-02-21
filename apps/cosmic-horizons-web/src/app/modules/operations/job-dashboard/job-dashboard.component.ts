import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { JobOrchestrationService } from '../../../features/job-orchestration/job-orchestration.service';
import { Job } from '../../../features/job-orchestration/job.models';
import { MessagingService } from '../../../services/messaging.service';
import { JobDetailsDialogComponent } from './job-details-dialog.component';
// this component is declared in OperationsModule

// Use the same Job interface from the orchestration feature for consistency.

// allow temporary animation flag on jobs
export type JobWithUpdate = Job & { updated?: boolean };

@Component({
  selector: 'app-job-dashboard',
  templateUrl: './job-dashboard.component.html',
  styleUrls: ['./job-dashboard.component.scss'],
  standalone: false, // required by coding standard
  // declared in OperationsModule
})
export class JobDashboardComponent implements OnInit, OnDestroy {
  /**
   * local copy used for table rendering; updates are pushed through
   * various channels (behavior subject + websocket) and we need to be able to
   * mutate objects for animation flags.
   */
  // prefer `inject` per eslint rule
  private jobService = inject(JobOrchestrationService);
  private messaging = inject(MessagingService);
  private dialog = inject(MatDialog);

  jobs: JobWithUpdate[] = [];


  /** container for all subscriptions so we can unsubscribe cleanly */
  private subs = new Subscription();

  /** optional status filter used to limit which job rooms we join */
  filterStatus?: string;

  // column list for table definition - make dynamic so we can add actions
  columns: string[] = [
    'jobId',
    'name',
    'agentName',
    'status',
    'startedAt',
    'estimatedTimeRemaining',
    'progress',
    'actions',
  ];

  // expose the raw observable so the template could switch to async pipe
  jobs$ = this.jobService.jobs$;

  constructor() {
    // no in‑page mock heartbeat – real-time updates come from the API
  }


  ngOnInit() {
    // ensure websocket connection is ready (auth handled internally)
    this.messaging.ensureConnected();

    // subscribe to service for initial and ongoing job data.  we keep a
    // clone of the list so we can apply transient `updated` flags later.
    this.subs.add(
      this.jobService.jobs$.subscribe((jobs) => {
        // apply status filter locally for display
        let filtered = jobs;
        if (this.filterStatus) {
          filtered = jobs.filter((j) => j.status === this.filterStatus);
        }
        this.jobs = filtered.map((j) => ({ ...j }));

        // join sockets only for displayed jobs
        filtered.forEach((j) => {
          this.messaging.joinJobChannel(j.id).catch(() => {
            // ignore failures during tests or disconnected state
          });
        });
      }),
    );

    // listen for job updates coming over websocket
    this.subs.add(
      this.messaging.jobUpdate$.subscribe(
        (update: Partial<Job> & { id: string }) => {
          const idx = this.jobs.findIndex((j) => j.id === update.id);
          if (idx !== -1) {
            this.jobs[idx] = { ...this.jobs[idx], ...update } as JobWithUpdate;
            // add temporary highlight flag used by styles in the template
            this.jobs[idx].updated = true;
            setTimeout(() => delete this.jobs[idx].updated, 1000);
          }
        },
      ),
    );
  }

  ngOnDestroy() {
    // tear down subscriptions created in ngOnInit
    this.subs.unsubscribe();
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

  /**
   * Open a dialog showing detailed information for the selected job.  This
   * replaces the previous log-only stub; later we may expand the view to
   * include charts, logs, etc.
   */
  openDetails(job: Job) {
    this.dialog.open(JobDetailsDialogComponent, {
      width: '400px',
      data: job,
    });
  }
}
