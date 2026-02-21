import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSliderModule } from '@angular/material/slider';
import { PerformanceHeatmapComponent } from './performance-heatmap.component';
import { PerformanceDataService } from '../../../services/performance-data.service';
import { Subject } from 'rxjs';

describe('PerformanceHeatmapComponent', () => {
  let component: PerformanceHeatmapComponent;
  let fixture: ComponentFixture<PerformanceHeatmapComponent>;
  let perf: Partial<PerformanceDataService>;
  let cpu$: Subject<number[][]>;
  let length$: Subject<number>;

  beforeEach(async () => {
    cpu$ = new Subject();
    length$ = new Subject();
    perf = {
      cpuHeatmap$: cpu$.asObservable(),
      historyLength$: length$.asObservable(),
      setWindow: vi.fn(),
    } as any;

    await TestBed.configureTestingModule({
      imports: [PerformanceHeatmapComponent, NoopAnimationsModule, MatSliderModule],
      providers: [{ provide: PerformanceDataService, useValue: perf }],
    }).compileComponents();

    fixture = TestBed.createComponent(PerformanceHeatmapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('updates heatmap when service emits and converts to chart format', () => {
    const sample = [[1, 2], [3, 4]];
    cpu$.next(sample);
    expect(component.heatmap).toEqual([
      { name: 'row 0', series: [{ name: '0', value: 1 }, { name: '1', value: 2 }] },
      { name: 'row 1', series: [{ name: '0', value: 3 }, { name: '1', value: 4 }] },
    ]);
  });

  it('renders material slider when windowCount provided', () => {
    length$.next(2);
    fixture.detectChanges();
    const slider = fixture.nativeElement.querySelector('mat-slider');
    expect(slider).not.toBeNull();
  });

  it('updates currentWindow and calls service when slider changes via ngModel', () => {
    length$.next(3);
    fixture.detectChanges();

    const sliderDebug = fixture.debugElement.query(
      (de) => de.name === 'mat-slider'
    );
    // simulate ngModelChange event
    sliderDebug.triggerEventHandler('ngModelChange', 2);
    expect(component.currentWindow).toBe(2);
    expect(perf.setWindow).toHaveBeenCalledWith(2);
  });


});