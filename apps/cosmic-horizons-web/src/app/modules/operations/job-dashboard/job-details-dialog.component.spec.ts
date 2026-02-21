import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobDetailsDialogComponent, JobDetailsData } from './job-details-dialog.component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';

describe('JobDetailsDialogComponent', () => {
  let fixture: ComponentFixture<JobDetailsDialogComponent>;
  const data: JobDetailsData = { id: 'job-123', name: 'test-job', status: 'running', progress: 50 };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [JobDetailsDialogComponent],
      imports: [NoopAnimationsModule, MatButtonModule, (await import('@angular/material/dialog')).MatDialogModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(JobDetailsDialogComponent);
    fixture.detectChanges();
  });

  it('should display passed job data', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('p').textContent).toContain('job-123');
    expect(compiled.textContent).toContain('test-job');
    expect(compiled.textContent).toContain('running');
    expect(compiled.textContent).toContain('50%');
  });
});
