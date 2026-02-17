import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobSubmissionFormComponent } from './job-submission-form.component';
import { JobOrchestrationModule } from '../job-orchestration.module';
import { JobOrchestrationService } from '../job-orchestration.service';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('JobSubmissionFormComponent', () => {
  let component: JobSubmissionFormComponent;
  let fixture: ComponentFixture<JobSubmissionFormComponent>;
  let mockJobService: any;

  beforeEach(async () => {
    // Angular Forms checks navigator.userAgent during DefaultValueAccessor init.
    // CI jsdom can expose it as undefined in some runners.
    try {
      Object.defineProperty(navigator, 'userAgent', {
        value: navigator.userAgent || 'jsdom',
        configurable: true,
      });
      Object.defineProperty(navigator, 'platform', {
        value: navigator.platform || 'Linux',
        configurable: true,
      });
    } catch {
      // Ignore if navigator properties are non-configurable in the local runtime.
    }

    mockJobService = {
      getAgents: vi.fn().mockReturnValue(of([])),
      submitJob: vi.fn().mockReturnValue(of({})),
    };

    await TestBed.configureTestingModule({
      imports: [JobOrchestrationModule],
      providers: [
        { provide: JobOrchestrationService, useValue: mockJobService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(JobSubmissionFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with default values', () => {
    expect(component.submissionForm).toBeTruthy();
    expect(component.submissionForm.get('agentId')?.value).toBe('alphacal-001');
    expect(component.submissionForm.get('cpuCores')?.value).toBe(32);
  });

  it('should validate required fields', () => {
    component.submissionForm.get('jobName')?.setValue('');
    expect(component.submissionForm.get('jobName')?.hasError('required')).toBe(
      true,
    );
  });

  it('should add parameter', () => {
    expect(component.parameterFields.length).toBe(0);
    component.addParameter();
    expect(component.parameterFields.length).toBe(1);
  });

  it('should remove parameter', () => {
    component.parameterFields.push({ key: 'test', value: 'value' });
    component.removeParameter(0);
    expect(component.parameterFields.length).toBe(0);
  });
});
