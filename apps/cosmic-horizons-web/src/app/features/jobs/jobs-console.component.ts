import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';

type JobStatusValue =
  | 'QUEUED'
  | 'QUEUING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED'
  | 'CANCELLED';

interface OptimizationTip {
  category: 'memory' | 'gpu' | 'runtime' | 'rfi_strategy' | 'cost' | string;
  severity: 'info' | 'warning' | 'critical' | string;
  message: string;
  suggestedValue?: string | number;
}

interface TaccJobStatus {
  id: string;
  tacc_job_id?: string;
  status: JobStatusValue;
  progress: number;
  output_url?: string;
  result?: {
    output_url?: string;
  };
}

interface JobSubmitResponse {
  jobId?: string;
  id?: string;
  tacc_job_id?: string;
}

interface JobUiMeta {
  submittedAtIso: string;
  agent: string;
  datasetId: string;
  targetName: string;
  scienceIntent: string;
}

type JobFilter = 'ALL' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

interface PreflightQaResponse {
  answer: string;
  confidence: 'low' | 'medium' | 'high';
  caveats: string[];
  source: 'llm' | 'heuristic';
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
  targetName = 'M87 Core Field';
  rightAscensionHours = 12.5137;
  declinationDegrees = 12.3911;
  frequencyBand = 'L';
  observationDurationHours = 4;
  productGoal = 'science-ready-image-cube';
  maxRuntime = '48h';
  rfiStrategy: 'low' | 'medium' | 'high' | 'high_sensitivity' = 'medium';
  gpuCount = 1;

  activeJobs: TaccJobStatus[] = [];
  jobMetaById: Record<string, JobUiMeta> = {};
  isLoading = false;
  capabilities: Record<string, boolean> = {};
  optimizationTips: OptimizationTip[] = [];
  showControlGuide = false;
  summaryExpanded = false;
  qaPanelOpen = false;
  qaQuestion = '';
  qaLoading = false;
  qaError = '';
  qaResponse: PreflightQaResponse | null = null;
  selectedFilter: JobFilter = 'ALL';
  readonly filters: JobFilter[] = [
    'ALL',
    'QUEUED',
    'RUNNING',
    'COMPLETED',
    'FAILED',
  ];
  readonly qaSuggestedQuestions = [
    'What will this job do for my selected target?',
    'Should I change GPUs or runtime before submitting?',
    'What risks or failure modes should I expect?',
    'Is this setup better for reconstruction or anomaly detection?',
  ];

  readonly scienceProductOptions = [
    'science-ready-image-cube',
    'continuum-image',
    'calibrated-visibilities',
    'anomaly-report',
  ];
  readonly frequencyBands = ['L', 'S', 'C', 'X', 'Ku', 'K', 'Ka', 'Q'];

  private readonly agentWorkflow: Record<
    string,
    { objective: string; output: string; note: string }
  > = {
    AlphaCal: {
      objective:
        'Calibrate interferometric visibilities with direction-dependent corrections and RFI mitigation.',
      output:
        'Calibrated visibility set and quality diagnostics for downstream imaging.',
      note: 'Best for improving signal fidelity before image reconstruction.',
    },
    ImageReconstruction: {
      objective:
        'Reconstruct radio sky images from calibrated visibilities using GPU-accelerated processing.',
      output:
        'Science-ready image products (continuum/cube) with provenance metadata.',
      note: 'This is the closest path to reconstructing radio structure for a target field.',
    },
    AnomalyDetection: {
      objective:
        'Scan processed data products for candidate transients or calibration anomalies.',
      output:
        'Ranked anomaly events with confidence indicators and review links.',
      note: 'Designed for event discovery, not primary image formation.',
    },
  };

  trackById(index: number, item: { id: string }) {
    return item.id;
  }

  get selectedAgentSummary() {
    // object has an index signature, so accessing a hard‑coded property must use
    // bracket notation to satisfy the Angular compiler/plugin (TS4111).
    return (
      this.agentWorkflow[this.selectedAgent] ?? this.agentWorkflow['AlphaCal']
    );
  }

  get scienceIntentSummary(): string {
    return [
      `${this.selectedAgent}: ${this.selectedAgentSummary.objective}`,
      `Target ${this.targetName} at RA ${this.rightAscensionHours}h / Dec ${this.declinationDegrees}deg.`,
      `Band ${this.frequencyBand}, ${this.observationDurationHours}h window, product ${this.productGoal}.`,
    ].join(' ');
  }

  get filteredJobs(): TaccJobStatus[] {
    if (this.selectedFilter === 'ALL') {
      return this.activeJobs;
    }
    if (this.selectedFilter === 'QUEUED') {
      return this.activeJobs.filter(
        (job) => job.status === 'QUEUED' || job.status === 'QUEUING',
      );
    }
    return this.activeJobs.filter((job) => job.status === this.selectedFilter);
  }

  get totalJobs(): number {
    return this.activeJobs.length;
  }

  get queuedJobs(): number {
    return this.activeJobs.filter(
      (job) => job.status === 'QUEUED' || job.status === 'QUEUING',
    ).length;
  }

  get runningJobs(): number {
    return this.activeJobs.filter((job) => job.status === 'RUNNING').length;
  }

  get completedJobs(): number {
    return this.activeJobs.filter((job) => job.status === 'COMPLETED').length;
  }

  get failedJobs(): number {
    return this.activeJobs.filter((job) => job.status === 'FAILED').length;
  }

  ngOnInit(): void {
    this.loadJobs();
    this.http
      .get<Record<string, boolean>>('/api/jobs/capabilities')
      .subscribe((caps) => {
        this.capabilities = caps;
      });
  }

  loadJobs() {
    // In a real app, we'd poll or use WebSockets
    // For the spike, we'll just have a refresh button
  }

  submitJob() {
    this.isLoading = true;
    const submission = this.buildSubmissionPayload();

    this.http
      .post<JobSubmitResponse>('/api/jobs/submit', submission)
      .subscribe({
        next: (res) => {
          const jobId = res.id ?? res.jobId;
          const displayId = res.tacc_job_id ?? jobId;

          if (!jobId) {
            this.snackBar.open(
              'Job submitted, but no job ID was returned',
              'Close',
              {
                duration: 5000,
                panelClass: ['toast-warn'],
              },
            );
            this.isLoading = false;
            this.cdr.markForCheck();
            return;
          }

          this.snackBar.open(`Job ${displayId} submitted successfully`, 'OK', {
            duration: 3000,
            panelClass: ['toast-success'],
          });
          this.jobMetaById[jobId] = {
            submittedAtIso: new Date().toISOString(),
            agent: this.selectedAgent,
            datasetId: this.datasetId,
            targetName: this.targetName,
            scienceIntent: this.scienceIntentSummary,
          };
          // fetch optimization tips for this submission
          this.http
            .post<unknown[]>('/api/jobs/optimize', submission)
            .subscribe((tips) => {
              this.optimizationTips = this.normalizeOptimizationTips(tips);
              // mark for check so the async assignment doesn't trigger a change-error
              this.cdr.markForCheck();
            });
          this.pollStatus(jobId);
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
    this.http.get<TaccJobStatus>(`/api/jobs/${jobId}/status`).subscribe({
      next: (status) => {
        const normalizedStatus: TaccJobStatus = {
          ...status,
          progress: this.normalizeProgress(status.progress),
          output_url: status.output_url ?? status.result?.output_url,
        };
        // double-defer the update: first tick to exit this callback, second
        // tick to mutate the array.  this prevents the new mat-progress-bar
        // from being instantiated in the same change-detection cycle that
        // triggered the HTTP callback (which was causing NG0100 errors).
        setTimeout(() => {
          setTimeout(() => {
            const index = this.activeJobs.findIndex((j) => j.id === jobId);
            if (index > -1) {
              this.activeJobs[index] = normalizedStatus;
            } else {
              this.activeJobs.push(normalizedStatus);
            }
            // force a second CD to flush any child-component updates
            this.cdr.detectChanges();
            // continue polling if still running
            if (
              normalizedStatus.status !== 'COMPLETED' &&
              normalizedStatus.status !== 'FAILED' &&
              normalizedStatus.status !== 'CANCELED' &&
              normalizedStatus.status !== 'CANCELLED'
            ) {
              setTimeout(() => this.pollStatus(jobId), 5000);
            }
          });
        });
      },
    });
  }

  tipLabel(tip: OptimizationTip): string {
    const severity = tip.severity.toUpperCase();
    const suggestion =
      tip.suggestedValue !== undefined
        ? ` Suggested: ${tip.suggestedValue}.`
        : '';
    return `[${severity}] ${tip.message}${suggestion}`;
  }

  filterLabel(filter: JobFilter): string {
    if (filter === 'ALL') {
      return `ALL (${this.totalJobs})`;
    }
    if (filter === 'QUEUED') {
      return `QUEUED (${this.queuedJobs})`;
    }
    if (filter === 'RUNNING') {
      return `RUNNING (${this.runningJobs})`;
    }
    if (filter === 'COMPLETED') {
      return `COMPLETED (${this.completedJobs})`;
    }
    return `FAILED (${this.failedJobs})`;
  }

  isTerminalStatus(status: JobStatusValue): boolean {
    return (
      status === 'COMPLETED' ||
      status === 'FAILED' ||
      status === 'CANCELED' ||
      status === 'CANCELLED'
    );
  }

  getMeta(jobId: string): JobUiMeta | undefined {
    return this.jobMetaById[jobId];
  }

  getSubmittedLabel(jobId: string): string {
    const meta = this.getMeta(jobId);
    if (!meta) {
      return 'Unknown';
    }
    return new Date(meta.submittedAtIso).toLocaleString();
  }

  getJobDisplayId(job: TaccJobStatus): string {
    return job.tacc_job_id ?? job.id;
  }

  cancelJob(job: TaccJobStatus): void {
    if (this.isTerminalStatus(job.status)) {
      return;
    }
    this.http.delete<{ success: boolean }>(`/api/jobs/${job.id}`).subscribe({
      next: () => {
        this.activeJobs = this.activeJobs.map((entry) =>
          entry.id === job.id ? { ...entry, status: 'CANCELLED' } : entry,
        );
        this.snackBar.open(`Job ${this.getJobDisplayId(job)} canceled`, 'OK', {
          duration: 3000,
          panelClass: ['toast-success'],
        });
        this.cdr.markForCheck();
      },
      error: () => {
        this.snackBar.open('Failed to cancel job', 'Close', {
          duration: 5000,
          panelClass: ['toast-warn'],
        });
      },
    });
  }

  showJobDetails(job: TaccJobStatus): void {
    const meta = this.getMeta(job.id);
    const details = meta
      ? `Agent: ${meta.agent} | Target: ${meta.targetName} | Dataset: ${meta.datasetId}`
      : 'No extended metadata recorded for this job.';
    this.snackBar.open(details, 'Close', {
      duration: 8000,
    });
  }

  private normalizeProgress(progress: number): number {
    if (progress > 1) {
      return Math.max(0, Math.min(1, progress / 100));
    }
    return Math.max(0, Math.min(1, progress));
  }

  private normalizeOptimizationTips(rawTips: unknown[]): OptimizationTip[] {
    return rawTips
      .map((raw): OptimizationTip | null => {
        if (typeof raw === 'string') {
          return { category: 'runtime', severity: 'info', message: raw };
        }
        if (raw && typeof raw === 'object') {
          const candidate = raw as Partial<OptimizationTip>;
          if (typeof candidate.message === 'string') {
            return {
              category: candidate.category ?? 'runtime',
              severity: candidate.severity ?? 'info',
              message: candidate.message,
              suggestedValue: candidate.suggestedValue,
            };
          }
        }
        return null;
      })
      .filter((tip): tip is OptimizationTip => tip !== null);
  }

  askQuestion(question?: string): void {
    const prompt = (question ?? this.qaQuestion).trim();
    if (!prompt) {
      this.qaError = 'Enter a question before submitting.';
      this.qaResponse = null;
      return;
    }

    this.qaPanelOpen = true;
    this.qaQuestion = prompt;
    this.qaLoading = true;
    this.qaError = '';
    this.qaResponse = null;

    this.http
      .post<PreflightQaResponse>('/api/jobs/preflight-qa', {
        question: prompt,
        jobContext: this.buildSubmissionPayload(),
      })
      .subscribe({
        next: (response) => {
          this.qaResponse = response;
          this.qaLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.qaError =
            'Unable to retrieve a pre-run answer right now. Try again or proceed with current validation tips.';
          this.qaLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  clearQa(): void {
    this.qaQuestion = '';
    this.qaError = '';
    this.qaResponse = null;
    this.qaLoading = false;
  }

  private buildSubmissionPayload() {
    return {
      agent: this.selectedAgent,
      dataset_id: this.datasetId,
      params: {
        rfi_strategy: this.rfiStrategy,
        gpu_count: this.gpuCount,
        max_runtime: this.maxRuntime,
        target_name: this.targetName,
        target_ra_hours: this.rightAscensionHours,
        target_dec_degrees: this.declinationDegrees,
        frequency_band: this.frequencyBand,
        observation_duration_hours: this.observationDurationHours,
        product_goal: this.productGoal,
        science_intent: this.scienceIntentSummary,
      },
    };
  }
}
