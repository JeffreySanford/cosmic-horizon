import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { PermissionModalComponent } from './permission-modal/permission-modal.component';

export interface AgentMetrics {
  name: string;
  status: 'running' | 'idle' | 'failed';
  progress: number;
  throughput: number;
  lastUpdate: Date;
}

export interface InferenceSession {
  id: string;
  agentName: string;
  startTime: Date;
  estimatedCompletion: Date;
  currentPhase: string;
}

@Component({
  selector: 'app-inference',
  templateUrl: './inference.component.html',
  styleUrls: ['./inference.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InferenceComponent {
  private readonly dialog = inject(MatDialog);

  isExpanded = false;
  hasPermission = false;

  // Mock agent data for MVP
  agents: AgentMetrics[] = [
    {
      name: 'AlphaCal',
      status: 'running',
      progress: 67,
      throughput: 8.3,
      lastUpdate: new Date(),
    },
    {
      name: 'Radio Image Reconstruction',
      status: 'idle',
      progress: 0,
      throughput: 0,
      lastUpdate: new Date(),
    },
    {
      name: 'Anomaly Detection',
      status: 'running',
      progress: 42,
      throughput: 12.1,
      lastUpdate: new Date(),
    },
  ];

  activeSessions: InferenceSession[] = [
    {
      id: 'session-001',
      agentName: 'AlphaCal',
      startTime: new Date(Date.now() - 3600000),
      estimatedCompletion: new Date(Date.now() + 1800000),
      currentPhase: 'Direction-dependent calibration',
    },
  ];

  toggleExpanded(): void {
    if (!this.isExpanded && !this.hasPermission) {
      // Ask for permission when expanding for the first time
      const dialogRef = this.dialog.open(PermissionModalComponent, {
        width: '400px',
        disableClose: false,
      });

      dialogRef.afterClosed().subscribe((result: boolean) => {
        if (result) {
          this.hasPermission = true;
          this.isExpanded = true;
        }
      });
    } else {
      // Toggle if already has permission
      this.isExpanded = !this.isExpanded;
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'running':
        return '#3fb950';
      case 'idle':
        return '#8b949e';
      case 'failed':
        return '#f85149';
      default:
        return '#c9d1d9';
    }
  }

  formatThroughput(throughput: number): string {
    return `${(throughput * 1000).toFixed(0)} GB/s`;
  }

  getRunningAgentsCount(): number {
    return this.agents.filter((agent) => agent.status === 'running').length;
  }

  getPeakThroughput(): number {
    return Math.max(...this.agents.map((agent) => agent.throughput));
  }
}
