import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';

interface TaccJobStatus {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  output_url?: string;
}

@Component({
  selector: 'app-jobs-console',
  templateUrl: './jobs-console.component.html',
  styleUrls: ['./jobs-console.component.scss'],
  standalone: false,
})
export class JobsConsoleComponent implements OnInit {
  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  agents = ['AlphaCal', 'ImageReconstruction', 'AnomalyDetection'];
  selectedAgent = 'AlphaCal';
  datasetId = 'VLASS2.1.sb38593457.eb38602345.58784.45634282407';
  rfiStrategy: 'low' | 'medium' | 'high' | 'high_sensitivity' = 'medium';
  gpuCount = 1;

  activeJobs: TaccJobStatus[] = [];
  isLoading = false;

  ngOnInit(): void {
    this.loadJobs();
  }

  loadJobs() {
    // In a real app, we'd poll or use WebSockets
    // For the spike, we'll just have a refresh button
  }

  submitJob() {
    this.isLoading = true;
    const submission = {
      agent: this.selectedAgent,
      dataset_id: this.datasetId,
      params: {
        rfi_strategy: this.rfiStrategy,
        gpu_count: this.gpuCount,
      },
    };

    this.http
      .post<{ jobId: string }>('/api/jobs/submit', submission)
      .subscribe({
        next: (res) => {
          this.snackBar.open(`Job ${res.jobId} submitted successfully`, 'OK', {
            duration: 3000,
            panelClass: ['toast-success'],
          });
          this.pollStatus(res.jobId);
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.snackBar.open('Failed to submit job', 'Close', {
            duration: 5000,
            panelClass: ['toast-warn'],
          });
          this.isLoading = false;
          this.cdr.markForCheck();
          console.error(err);
        },
      });
  }

  pollStatus(jobId: string) {
    this.http.get<TaccJobStatus>(`/api/jobs/status/${jobId}`).subscribe({
      next: (status) => {
        // double-defer the update: first tick to exit this callback, second
        // tick to mutate the array.  this prevents the new mat-progress-bar
        // from being instantiated in the same change-detection cycle that
        // triggered the HTTP callback (which was causing NG0100 errors).
        setTimeout(() => {
          setTimeout(() => {
            const index = this.activeJobs.findIndex((j) => j.id === jobId);
            if (index > -1) {
              this.activeJobs[index] = status;
            } else {
              this.activeJobs.push(status);
            }
            // force a second CD to flush any child-component updates
            this.cdr.detectChanges();
            // continue polling if still running
            if (status.status !== 'COMPLETED' && status.status !== 'FAILED') {
              setTimeout(() => this.pollStatus(jobId), 5000);
            }
          });
        });
      },
    });
  }
}
