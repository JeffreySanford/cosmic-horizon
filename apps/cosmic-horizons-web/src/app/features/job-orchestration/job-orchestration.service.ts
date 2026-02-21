import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { MockModeService } from '../../services/mock-mode.service';
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
  // NOTE: The service now always interacts with the real backend.  There
  // used to be a `useMocks` toggle that simulated jobs for offline demos, but
  // that functionality has been removed in favor of a separate offline-demo
  // configuration feature.  The old flag and related polling logic have been
  // stripped; this comment remains for historical context until the next
  // cleanup sweep.

  private jobsSubject = new BehaviorSubject<Job[]>([]);
  public jobs$ = this.jobsSubject.asObservable();

  // series data for per-job progress chart
  private progressSeriesSubject = new BehaviorSubject<{
    name: string;
    series: { name: number; value: number }[];
  }[]>([]);
  public progressSeries$ = this.progressSeriesSubject.asObservable();

  // in-memory staging removed; all operations hit the API
  private pollingSub?: Subscription;
  private eventSource?: EventSource;

  // Injectable references via `inject` to satisfy ESLint
  private http = inject(HttpClient);
  private mockMode = inject(MockModeService);

  constructor() {
    // always pull fresh data and subscribe to server stream
    this.refreshFromServer();
    this.connectLiveUpdates();
  }


  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

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
    // always send to real API
    return this.http.post<JobSubmissionResponse>('/api/jobs/submit', request);
  }

  /**
   * Get all jobs
   *
   * Example of a service-level guard: when mock mode is enabled we bypass the
   * HTTP client and return an empty list (the interceptor could also handle
   * this globally). This illustrates step 4 of the migration guide.
   */
  getJobs(): Observable<Job[]> {
    if (this.mockMode.isMock) {
      return of([]);
    }
    return this.http.get<Job[]>('/api/jobs');
  }

  /**
   * Convenience API to retrieve current job count.  Hits the dedicated
   * `/api/jobs/count` endpoint on the server.
   */
  getJobCount(): Observable<number> {
    return this.http.get<{ count: number }>('/api/jobs/count').pipe(
      map((r) => r.count),
      // if API unavailable return zero instead of propagating error
      catchError(() => of(0)),
    );
  }

  /**
   * Get job by ID
   */
  getJobById(jobId: string): Observable<Job | undefined> {
    return this.http.get<Job>(`/api/jobs/${jobId}/status`);
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): Observable<void> {
    return this.http.post<void>(`/api/jobs/${jobId}/cancel`, {});
  }

  /**
   * Apply an incoming websocket/update partial to existing job list.
   * Useful when dashboard receives events from server or mocks.
   */
  applyJobUpdate(update: Partial<Job> & { id: string }) {
    // incoming server event, merge into current list
    this.jobsSubject.next(
      this.jobsSubject.getValue().map((j) =>
        j.id === update.id ? { ...j, ...update } : j,
      ),
    );
  }

  /**
   * Helper used by unit tests (and could be used by callers) to determine if
   * the polling timer has been started.
   */
  isPolling(): boolean {
    return !!this.pollingSub && !this.pollingSub.closed;
  }

  /**
   * Toggle between mock mode and live mode at runtime.
   * When switching off mocks we clear any in-memory job list and cancel the
   * polling subscription; then we immediately fetch the current jobs from the
   * server.  When enabling mocks we reset the data and restart the simulator.
   */
  // demo control removed; all callers should hit live data now

  // ------------------------------------------------------------------
  // internal helpers
  // ------------------------------------------------------------------

  // polling and simulation removed; live events come via SSE

  // mock data loader removed

  private refreshFromServer(): void {
    this.http.get<Job[]>('/api/jobs').pipe(
      catchError(() => of<Job[]>([])),
    ).subscribe((jobs) => {
      this.jobsSubject.next(jobs as Job[]);
      // also update progress series based on returned histories if provided
      const series = jobs.map((j) => ({
        name: j.name,
        series: (j.progressHistory || []).map((h) => ({ name: h.time, value: h.progress })),
      }));
      this.progressSeriesSubject.next(series);
    });
  }

  private connectLiveUpdates(): void {
    // EventSource is not available in node test environments; bail early.
    if (typeof EventSource === 'undefined') {
      return;
    }
    if (this.eventSource) {
      return;
    }
    this.eventSource = new EventSource('/api/jobs/stream');
    this.eventSource.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data) as Partial<Job> & { id: string };
        this.applyJobUpdate(update);
      } catch {
        // ignore bad data
      }
    };
    this.eventSource.onerror = () => {
      // could add retry logic here
    };
  }

  /**
   * Get agent name from ID
   */
}
