import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MatCardModule } from '@angular/material/card';
import { MatBadgeModule } from '@angular/material/badge';
import { MatChipsModule } from '@angular/material/chips';
import { beforeEach, describe, expect, it } from 'vitest';
import { BehaviorSubject, of } from 'rxjs';
import { MessagingService } from '../../../services/messaging.service';
import { OperationsHomeComponent } from './operations-home.component';
import { PerformanceDataService } from '../../../services/performance-data.service';

class MockMessagingService {
  jobUpdate$ = of(0);
  notifications$ = of(0);
  stats$ = new BehaviorSubject<any>({
    infra: { rabbitmq: { connected: true }, kafka: { connected: true } },
    at: '2026-02-21T00:00:00Z',
    packetsPerSecond: 123,
  });
}

const perfStub = {
  progressSeries$: of([{ name: 'w0', series: [{ name: 'avg', value: 42 }] }]),
};

describe('OperationsHomeComponent', () => {
  let fixture: ComponentFixture<OperationsHomeComponent>;
  let component: OperationsHomeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OperationsHomeComponent],
      imports: [RouterTestingModule, MatCardModule, MatBadgeModule, MatChipsModule],
      providers: [
        { provide: MessagingService, useClass: MockMessagingService },
        { provide: PerformanceDataService, useValue: perfStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OperationsHomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // ensure any synchronous updates from BehaviorSubject propagate
    const mock = TestBed.inject(MessagingService) as any;
    if (mock.stats$ && typeof mock.stats$.next === 'function') {
      mock.stats$.next(mock.stats$.value || mock.stats$._value);
      fixture.detectChanges();
    }
  });

  it('renders tile titles', () => {
    expect(component).toBeTruthy();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Broker Comparison');
    expect(text).toContain('Job Dashboard');
    expect(text).toContain('Node Performance');
    expect(text).toContain('Load Tests');
  });

  it('shows status chip and subtitles from stats and metrics chips', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('healthy');
    expect(text).toContain('refreshed 2026-02-21T00:00:00Z');
    expect(text).toContain('123 msg/s');

    // badge is rendered even if count is zero
    const badge = fixture.nativeElement.querySelector('.mat-badge-content');
    expect(badge).toBeTruthy();
    // mock notifications$ emits a single value, so badge increments once
    expect(badge.textContent.trim()).toBe('1');

    // CPU/GPU chips appear (stub returns 42)
    const chips = fixture.nativeElement.querySelectorAll('mat-chip');
    expect(chips.length).toBeGreaterThanOrEqual(2);
    const texts = Array.from(chips).map((c: any) => c.textContent.trim());
    expect(texts.some((t) => t.includes('CPU'))).toBe(true);

    // alert link is present since badge > 0
    const link = fixture.nativeElement.querySelector('.alert-link');
    expect(link).toBeTruthy();
    expect(link.textContent.trim()).toBe('View alerts');
  });
});
