import {
  Component,
  OnInit,
  OnChanges,
  Output,
  EventEmitter,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { JobOrchestrationService } from '../job-orchestration.service';
import { Job, JobStatus } from '../job.models';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-job-queue-list',
  standalone: false,
  templateUrl: './job-queue-list.component.html',
  styleUrls: ['./job-queue-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobQueueListComponent implements OnInit, OnChanges {
  private readonly jobService = inject(JobOrchestrationService);

  @Output() jobSelected = new EventEmitter<string>();
  @Output() jobCancelled = new EventEmitter<string>();

  filteredJobs$!: Observable<Job[]>;
  statusFilters: (JobStatus | 'all')[] = [
    'all',
    'running',
    'queued',
    'completed',
    'failed',
    'cancelled',
  ];
  selectedStatus: JobStatus | 'all' = 'all';

  ngOnInit(): void {
    this.updateFilteredJobs();
  }

  ngOnChanges(): void {
    this.updateFilteredJobs();
  }

  private updateFilteredJobs(): void {
    this.filteredJobs$ = this.jobService.getJobs().pipe(
      map((jobs) => {
        if (this.selectedStatus === 'all') {
          return jobs;
        }
        return jobs.filter((job) => job.status === this.selectedStatus);
      }),
    );
  }

  getStatusColor(status: JobStatus): string {
    switch (status) {
      case 'queued':
        return '#f0883e';
      case 'running':
        return '#3fb950';
      case 'completed':
        return '#238636';
      case 'failed':
        return '#f85149';
      case 'cancelled':
        return '#8b949e';
      default:
        return '#c9d1d9';
    }
  }

  getStatusIcon(status: JobStatus): string {
    switch (status) {
      case 'queued':
        return 'schedule';
      case 'running':
        return 'hourglass_top';
      case 'completed':
        return 'check_circle';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'cancel';
      default:
        return 'help';
    }
  }

  formatTimeRemaining(seconds?: number): string {
    if (!seconds || seconds <= 0) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  }

  calculateDuration(job: Job): string {
    if (!job.startedAt || !job.completedAt) return '-';
    const duration =
      (job.completedAt.getTime() - job.startedAt.getTime()) / 1000;
    return this.formatTimeRemaining(duration);
  }

  onJobDetail(jobId: string): void {
    this.jobSelected.emit(jobId);
  }

  onCancelJob(jobId: string): void {
    this.jobService.cancelJob(jobId).subscribe();
    this.jobCancelled.emit(jobId);
  }
}
