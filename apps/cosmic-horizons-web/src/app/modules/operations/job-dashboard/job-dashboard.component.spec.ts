import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { JobDashboardComponent } from './job-dashboard.component';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('JobDashboardComponent', () => {
  let component: JobDashboardComponent;
  let fixture: ComponentFixture<JobDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MatTableModule,
        MatProgressBarModule,
        NoopAnimationsModule,
      ],
      declarations: [JobDashboardComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(JobDashboardComponent);
    component = fixture.componentInstance;
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

  it('applies status class to status cell', () => {
    // first cell is IDs so skip to status column
    const statusCells = fixture.nativeElement.querySelectorAll('td');
    const status = statusCells[2].textContent.trim();
    const classList = statusCells[2].firstElementChild.classList;
    expect(classList).toContain(status.toLowerCase());
  });

  it('updates progress when heartbeat interval emits', fakeAsync(() => {
    const initial = component.jobs[1].progress;
    tick(5100);
    expect(component.jobs[1].progress).toBeGreaterThan(initial);
  }));
});