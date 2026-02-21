import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobDashboardComponent } from './job-dashboard.component';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { JobOrchestrationService } from '../../../features/job-orchestration/job-orchestration.service';

declare const spyOn: any;

describe('JobDashboardComponent', () => {
  let component: JobDashboardComponent;
  let fixture: ComponentFixture<JobDashboardComponent>;

  let jobService: JobOrchestrationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MatTableModule,
        MatProgressBarModule,
        MatCardModule,
        MatButtonModule,
        NoopAnimationsModule,
      ],
      declarations: [JobDashboardComponent],
      providers: [JobOrchestrationService],
    }).compileComponents();

    jobService = TestBed.inject(JobOrchestrationService);

    // ngOnInit will be replaced later per-instance to avoid socket logic
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(JobDashboardComponent);
    component = fixture.componentInstance;
    // replace ngOnInit to avoid WebSocket client
    component.ngOnInit = function(this: any) {
      this.jobService.jobs$.subscribe((jobs: any[]) => {
        this.jobs = jobs.map((j) => ({ ...j }));
      });
    };

    // initialize with some jobs from service
    jobService['mockJobs'] = [
      {
        id: 'job-001',
        name: 'Calibration run',
        agentId: 'alphacal-001',
        agentName: 'AlphaCal',
        status: 'queued',
        parameters: {},
        createdAt: new Date(),
        progress: 0,
      },
      {
        id: 'job-002',
        name: 'Deep field imaging',
        agentId: 'reconstruction-001',
        agentName: 'Radio Image Reconstruction',
        status: 'running',
        parameters: {},
        createdAt: new Date(),
        progress: 45,
      },
    ];
    jobService['jobsSubject'].next(jobService['mockJobs']);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders table rows for initial jobs', () => {
    const rows = fixture.nativeElement.querySelectorAll('tr.mat-row');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const firstRowText = rows[0].textContent;
    expect(firstRowText).toContain('job-001');
  });

  it('shows summary counts based on status', () => {
    const cards = fixture.nativeElement.querySelectorAll('.status-card');
    expect(cards.length).toBeGreaterThan(0);
    const text = cards[0].textContent;
    expect(text).toMatch(/QUEUED|RUNNING|COMPLETED|FAILED/);
  });

  it('applies status class to status cell', () => {
    const statusCells = fixture.nativeElement.querySelectorAll('td');
    const status = statusCells[2].textContent.trim();
    const classList = statusCells[2].firstElementChild.classList;
    expect(classList).toContain(status.toLowerCase());
  });

  it('cancels a job when Cancel button is clicked', async () => {
    fixture.detectChanges();
    const cancelBtn = fixture.nativeElement.querySelector('button');
    expect(cancelBtn).toBeTruthy();
    cancelBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    expect(component.jobs[0].status).toBe('cancelled');
  });


  it('updates progress when heartbeat interval emits', async () => {
    const initial = component.jobs[1].progress;
    await new Promise((r) => setTimeout(r, 5100));
    expect(component.jobs[1].progress).toBeGreaterThan(initial);
  });
});