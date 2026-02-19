import {
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { JobOrchestrationService } from './job-orchestration.service';
import { Job, Agent } from './job.models';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-job-orchestration',
  standalone: false,
  templateUrl: './job-orchestration.component.html',
  styleUrls: ['./job-orchestration.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobOrchestrationComponent implements OnInit {
  private readonly jobService = inject(JobOrchestrationService);

  jobs$!: Observable<Job[]>;
  agents$!: Observable<Agent[]>;

  selectedTabIndex = 0;

  ngOnInit(): void {
    this.jobs$ = this.jobService.getJobs();
    this.agents$ = this.jobService.getAgents();
  }

  getStatusColor(status: Job['status']): string {
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

  getStatusIcon(status: Job['status']): string {
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

  onJobSubmitted(): void {
    this.selectedTabIndex = 1;
  }

  cancelJob(jobId: string): void {
    this.jobService.cancelJob(jobId).subscribe();
  }

  onJobSelected(jobId: string): void {
    // Handle job selection - could open details dialog in future
    console.log('Job selected:', jobId);
  }

  onJobCancelled(jobId: string): void {
    this.cancelJob(jobId);
  }
}
