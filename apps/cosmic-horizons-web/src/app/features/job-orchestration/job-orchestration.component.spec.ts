import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobOrchestrationComponent } from './job-orchestration.component';
import { JobOrchestrationModule } from './job-orchestration.module';
import { JobOrchestrationService } from './job-orchestration.service';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('JobOrchestrationComponent', () => {
  let component: JobOrchestrationComponent;
  let fixture: ComponentFixture<JobOrchestrationComponent>;
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
      getJobs: vi.fn().mockReturnValue(of([])),
      getAgents: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [JobOrchestrationModule],
      providers: [
        { provide: JobOrchestrationService, useValue: mockJobService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(JobOrchestrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize observables', () => {
    expect(component.jobs$).toBeTruthy();
    expect(component.agents$).toBeTruthy();
  });

  it('should switch to queue tab on job submission', () => {
    component.selectedTabIndex = 0;
    component.onJobSubmitted();
    expect(component.selectedTabIndex).toBe(1);
  });

  it('should return correct status color', () => {
    expect(component.getStatusColor('running')).toBe('#3fb950');
    expect(component.getStatusColor('queued')).toBe('#f0883e');
  });

  it('should get correct status icon', () => {
    expect(component.getStatusIcon('running')).toBe('hourglass_top');
    expect(component.getStatusIcon('completed')).toBe('check_circle');
  });
});
