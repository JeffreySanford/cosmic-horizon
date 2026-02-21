import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';
import { OperationsModule } from '../operations.module';
import { ProgressGraphComponent } from './progress-graph.component';
import { JobOrchestrationService } from '../../../features/job-orchestration/job-orchestration.service';

describe('ProgressGraphComponent', () => {
  let component: ProgressGraphComponent;
  let fixture: ComponentFixture<ProgressGraphComponent>;
  let jobService: Partial<JobOrchestrationService>;
  let progress$: Subject<any[]>;

  beforeEach(async () => {
    progress$ = new Subject();
    jobService = {
      progressSeries$: progress$.asObservable(),
    } as any;

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, HttpClientTestingModule, OperationsModule],
      providers: [{ provide: JobOrchestrationService, useValue: jobService }],
    }).compileComponents();

    // no need to flush; service now swallows errors from /api/jobs

    fixture = TestBed.createComponent(ProgressGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('updates series when service emits progression data', () => {
    const sample = [
      { name: 'series 0', series: [{ name: '0', value: 5 }] },
      { name: 'series 1', series: [{ name: '0', value: 7 }] },
    ];
    progress$.next(sample);
    expect(component.series).toEqual(sample);
  });
});
