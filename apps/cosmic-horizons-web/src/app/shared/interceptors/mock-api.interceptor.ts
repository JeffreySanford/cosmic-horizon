import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpResponse,
} from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { MockModeService } from '../../services/mock-mode.service';

/**
 * Mock API Interceptor for Development
 *
 * Intercepts HTTP requests to CosmicAI portal endpoints and returns mock data.
 * This allows testing the Jobs Console UI without a running backend.
 *
 * In production, this interceptor will be removed and real API calls will be used.
 */
@Injectable()
export class MockApiInterceptor implements HttpInterceptor {
  private jobCounter = 0;
  private mode = inject(MockModeService);

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    // bypass mock logic if the toggle is off
    if (!this.mode.isMock) {
      return next.handle(req);
    }

    // Mock job submission
    if (req.url.includes('/api/jobs/submit') && req.method === 'POST') {
      this.jobCounter++;
      const jobId = `JOB-${Date.now()}-${this.jobCounter}`;
      console.log('[MOCK] Job submission intercepted:', jobId);
      return of(
        new HttpResponse({
          status: 200,
          body: { jobId },
        }),
      ).pipe(delay(500));
    }

    // Mock job status polling
    if (req.url.includes('/api/jobs/status/') && req.method === 'GET') {
      const jobId = req.url.split('/').pop();
      const statuses: Array<'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'> = [
        'QUEUED',
        'RUNNING',
        'COMPLETED',
        'FAILED',
      ];
      const randomStatus =
        statuses[Math.floor(Math.random() * statuses.length)];

      return of(
        new HttpResponse({
          status: 200,
          body: {
            id: jobId,
            status: randomStatus,
            progress: Math.random() * 100,
            output_url:
              randomStatus === 'COMPLETED'
                ? `https://tacc.utexas.edu/results/${jobId}`
                : undefined,
          },
        }),
      ).pipe(delay(300));
    }

    // Forward all other requests to the actual backend
    return next.handle(req);
  }
}
