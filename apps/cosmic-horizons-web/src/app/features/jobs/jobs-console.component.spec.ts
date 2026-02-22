// Aggressive polyfill for jsdom test environment - Angular Forms navigator.platform fix
// Must run BEFORE any Angular Forms imports
(function ensureNavigatorPlatform() {
  if (typeof navigator !== 'undefined') {
    try {
      // Check if platform is undefined or empty
      if (navigator.platform === undefined || navigator.platform === '') {
        // Try to define it
        Object.defineProperty(navigator, 'platform', {
          value: 'Linux x86_64',
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
    } catch (e) {
      try {
        // Fallback: try direct assignment
        (navigator as any).platform = 'Linux x86_64';
      } catch (err) {
        console.warn('Could not define navigator.platform:', err);
      }
    }

    // Also ensure window.navigator.platform
    if (typeof window !== 'undefined' && window.navigator) {
      try {
        if (
          window.navigator.platform === undefined ||
          window.navigator.platform === ''
        ) {
          Object.defineProperty(window.navigator, 'platform', {
            value: 'Linux x86_64',
            writable: true,
            configurable: true,
          });
        }
      } catch (e) {
        try {
          (window.navigator as any).platform = 'Linux x86_64';
        } catch (err) {
          console.warn('Could not define window.navigator.platform:', err);
        }
      }
    }
  }
})();

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { JobsConsoleComponent } from './jobs-console.component';

describe('JobsConsoleComponent', () => {
  let component: JobsConsoleComponent;
  let fixture: ComponentFixture<JobsConsoleComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [JobsConsoleComponent],
      imports: [
        CommonModule,
        FormsModule,
        RouterTestingModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        MatChipsModule,
        MatTooltipModule,
        MatSnackBarModule,
        NoopAnimationsModule,
      ],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(JobsConsoleComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // ngOnInit capabilities call
    const capabilities = httpMock.expectOne('/api/jobs/capabilities');
    capabilities.flush({ demoMode: true, baseUrlReachable: true });

    // ngOnInit dataset load
    const initialDatasets = httpMock.expectOne('/api/datasets');
    initialDatasets.flush([
      {
        id: 'seed-1',
        label: 'Seed Dataset',
        lastUpdated: new Date().toISOString(),
      },
    ]);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should load datasets on init and pick first', () => {
    expect(component.datasets.length).toBe(1);
    expect(component.selectedDataset?.id).toBe('seed-1');
    expect(component.datasetId).toBe('seed-1');
  });

  it('should update datasetId when selection changes', () => {
    component.datasets = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
    component.selectedDataset = component.datasets[0];
    component.datasetId = component.selectedDataset.id;

    component.selectedDataset = component.datasets[1];
    component.datasetId = component.selectedDataset.id;

    expect(component.datasetId).toBe('b');
  });

  it('refreshDatasets should POST and replace list', () => {
    component.refreshDatasets();
    const refreshReq = httpMock.expectOne('/api/datasets/refresh');
    expect(refreshReq.request.method).toBe('POST');
    refreshReq.flush([{ id: 'y', label: 'Y' }]);

    expect(component.datasets[0].id).toBe('y');
    expect(component.selectedDataset?.id).toBe('y');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should require question text before preflight submit', () => {
    component.qaQuestion = '   ';

    component.askQuestion();

    expect(component.qaError).toContain('Enter a question');
    expect(component.qaResponse).toBeNull();
    expect(component.qaLoading).toBe(false);
  });

  it('should post preflight question and store response', () => {
    component.qaQuestion = 'Should I change GPUs?';

    component.askQuestion();

    const request = httpMock.expectOne('/api/jobs/preflight-qa');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.question).toBe('Should I change GPUs?');
    expect(request.request.body.jobContext.agent).toBe(component.selectedAgent);

    request.flush({
      answer: 'Keep current GPU count for now.',
      confidence: 'medium',
      caveats: ['Queue pressure may change runtime.'],
      source: 'heuristic',
    });

    expect(component.qaLoading).toBe(false);
    expect(component.qaError).toBe('');
    expect(component.qaResponse?.source).toBe('heuristic');
    expect(component.qaResponse?.answer).toContain('GPU');
  });

  it('should show an error when preflight endpoint fails', () => {
    component.askQuestion('What can fail?');

    const request = httpMock.expectOne('/api/jobs/preflight-qa');
    request.flush({ message: 'failed' }, { status: 500, statusText: 'Error' });

    expect(component.qaLoading).toBe(false);
    expect(component.qaResponse).toBeNull();
    expect(component.qaError).toContain('Unable to retrieve a pre-run answer');
  });

  it('should reset qa panel state with clearQa', () => {
    component.qaQuestion = 'Question';
    component.qaLoading = true;
    component.qaError = 'error';
    component.qaResponse = {
      answer: 'a',
      confidence: 'low',
      caveats: ['c'],
      source: 'heuristic',
    };

    component.clearQa();

    expect(component.qaQuestion).toBe('');
    expect(component.qaLoading).toBe(false);
    expect(component.qaError).toBe('');
    expect(component.qaResponse).toBeNull();
  });

  it('should prefer tacc job id for display when available', () => {
    expect(
      component.getJobDisplayId({
        id: 'job-1',
        tacc_job_id: 'tacc-777',
        status: 'QUEUED',
        progress: 0,
      }),
    ).toBe('tacc-777');
  });
});
