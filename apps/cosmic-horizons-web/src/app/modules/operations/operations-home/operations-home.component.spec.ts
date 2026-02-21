import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MatCardModule } from '@angular/material/card';
import { MatBadgeModule } from '@angular/material/badge';
import { MatIconModule } from '@angular/material/icon';
import { beforeEach, describe, expect, it } from 'vitest';
import { BehaviorSubject, of } from 'rxjs';
import { MessagingService } from '../../../services/messaging.service';
import { OperationsHomeComponent } from './operations-home.component';
import { PerformanceDataService } from '../../../services/performance-data.service';
import { JobOrchestrationService } from '../../../features/job-orchestration/job-orchestration.service';

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
  gpuProgressSeries$: of([{ name: 'w0', series: [{ name: 'avg', value: 42 }] }]),
};

const jobServiceStub = {
  getJobCount: () => of(1),
};

describe('OperationsHomeComponent', () => {
  let fixture: ComponentFixture<OperationsHomeComponent>;
  let component: OperationsHomeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OperationsHomeComponent],
      imports: [RouterTestingModule, MatCardModule, MatBadgeModule, MatIconModule],
      providers: [
        { provide: MessagingService, useClass: MockMessagingService },
        { provide: PerformanceDataService, useValue: perfStub },
        { provide: JobOrchestrationService, useValue: jobServiceStub },
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

  it('renders tile titles and icons', async () => {
    expect(component).toBeTruthy();
    await fixture.whenStable();
    fixture.detectChanges();
    const titles = fixture.nativeElement.querySelectorAll('.tile-title');
    const titleTexts = Array.from(titles).map((el: any) => el.textContent.trim());
    expect(titleTexts).toContain('Broker Comparison');
    expect(titleTexts).toContain('Job Dashboard');
    expect(titleTexts).toContain('Node Performance');
    expect(titleTexts).toContain('Load Tests');

    const icons = fixture.nativeElement.querySelectorAll('.tile-icon mat-icon');
    const iconTexts = Array.from(icons).map((el: any) => el.textContent.trim());
    expect(iconTexts).toContain('compare_arrows');
    expect(iconTexts).toContain('dashboard');
    expect(iconTexts).toContain('memory');
    expect(iconTexts).toContain('speed');
  });

  it('shows status chip and subtitles from stats and metrics chips', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const statusChip = fixture.nativeElement.querySelector('.status-chip');
    expect(statusChip).toBeTruthy();
    expect(statusChip.textContent).toContain('healthy');

    const subtitle = fixture.nativeElement.querySelector('.tile-subtitle');
    expect(subtitle.textContent).toContain('Refreshed');

    const badgeContent: HTMLElement | null = fixture.nativeElement.querySelector('.mat-badge-content');
    expect(badgeContent).toBeTruthy();
    expect(badgeContent?.textContent?.trim()).toBe('1');

    const chips = fixture.nativeElement.querySelectorAll('.tile-chips .tile-pill');
    expect(chips.length).toBeGreaterThanOrEqual(2);
    const texts = Array.from(chips).map((c: any) => c.textContent.trim());
    expect(texts.some((t) => t.includes('CPU'))).toBe(true);
    expect(texts.some((t) => t.includes('GPU'))).toBe(true);

    const link = fixture.nativeElement.querySelector('.alert-link');
    expect(link).toBeTruthy();
    expect(link.textContent.trim()).toBe('View alerts');
  });
});
