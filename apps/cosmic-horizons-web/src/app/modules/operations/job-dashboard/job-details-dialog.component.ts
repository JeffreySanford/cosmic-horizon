import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface JobDetailsData {
  id: string;
  name: string;
  status?: string;
  progress?: number;
  // additional fields as needed
}

@Component({
  selector: 'app-job-details-dialog',
  standalone: false,
  template: `
    <h2 mat-dialog-title>Job Details</h2>
    <mat-dialog-content>
      <p><strong>ID:</strong> {{ data.id }}</p>
      <p><strong>Name:</strong> {{ data.name }}</p>
      <p *ngIf="data.status"><strong>Status:</strong> {{ data.status }}</p>
      <p *ngIf="data.progress !== undefined">
        <strong>Progress:</strong> {{ data.progress }}%
      </p>
      <!-- TODO: include mini chart/throughput here -->
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
})
export class JobDetailsDialogComponent {
  dialogRef = inject(MatDialogRef<JobDetailsDialogComponent>);
  data = inject(MAT_DIALOG_DATA) as JobDetailsData;
}
