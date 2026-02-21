import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ProgressGraphComponent } from './progress-graph.component';
import { PerformanceDataService } from '../../../services/performance-data.service';
import { Subject } from 'rxjs';

describe('ProgressGraphComponent', () => {
  let component: ProgressGraphComponent;
  let fixture: ComponentFixture<ProgressGraphComponent>;
  let perf: Partial<PerformanceDataService>;
  let progress$: Subject<any[]>;

  beforeEach(async () => {
    progress$ = new Subject();
    perf = {
      progressSeries$: progress$.asObservable(),
    } as any;

    await TestBed.configureTestingModule({
      imports: [ProgressGraphComponent, NoopAnimationsModule],
      providers: [{ provide: PerformanceDataService, useValue: perf }],
    }).compileComponents();

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