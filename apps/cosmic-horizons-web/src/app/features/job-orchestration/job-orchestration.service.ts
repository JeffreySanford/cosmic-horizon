import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { MockModeService } from '../../services/mock-mode.service';
import {
  Job,
  JobSubmissionRequest,
  JobSubmissionResponse,
  Agent,
} from './job.models';
import * as JobsActions from '../../store/features/jobs/jobs.actions';
import {
  selectAllJobs,
  selectJobCount,
  selectJobsEntities,
  selectProgressSeries,
} from '../../store/features/jobs/jobs.selectors';
import { AppState } from '../../store/app.state';

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

  public jobs$: Observable<Job[]>;
  public progressSeries$: Observable<{
    name: string;
    series: { name: number; value: number }[];
  }[]>;

  // Injectable references via `inject` to satisfy ESLint
  private http = inject(HttpClient);
  private mockMode = inject(MockModeService);
  private store = inject<Store<AppState>>(Store);

  constructor() {
    this.jobs$ = this.store.select(selectAllJobs);
    this.progressSeries$ = this.store.select(selectProgressSeries);
    this.store.dispatch(JobsActions.jobsInitialize());
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
    this.store.dispatch(JobsActions.jobSubmittedRequested({ request }));
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
    return this.jobs$;
  }

  /**
   * Convenience API to retrieve current job count.  Hits the dedicated
   * `/api/jobs/count` endpoint on the server.
   */
  getJobCount(): Observable<number> {
    return this.store.select(selectJobCount);
  }

  /**
   * Get job by ID
   */
  getJobById(jobId: string): Observable<Job | undefined> {
    return this.store.select(selectJobsEntities).pipe(map((entities) => entities[jobId]));
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): Observable<void> {
    this.store.dispatch(JobsActions.jobCancelledRequested({ jobId }));
    return this.http.post<void>(`/api/jobs/${jobId}/cancel`, {});
  }

  /**
   * Apply an incoming websocket/update partial to existing job list.
   * Useful when dashboard receives events from server or mocks.
   */
  applyJobUpdate(update: Partial<Job> & { id: string }) {
    this.store.dispatch(JobsActions.jobUpdateReceived({ update }));
  }

  /**
   * Helper used by unit tests (and could be used by callers) to determine if
   * the polling timer has been started.
   */
  isPolling(): boolean {
    return false;
  }

  /**
   * Toggle between mock mode and live mode at runtime.
   * When switching off mocks we clear any in-memory job list and cancel the
   * polling subscription; then we immediately fetch the current jobs from the
   * server.  When enabling mocks we reset the data and restart the simulator.
   */
  // demo control removed; all callers should hit live data now

  /**
   * Get agent name from ID
   */
}
