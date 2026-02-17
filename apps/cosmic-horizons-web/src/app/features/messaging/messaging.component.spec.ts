import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessagingComponent } from './messaging.component';
import { MessagingService } from '../../services/messaging.service';
import { CommonModule } from '@angular/common';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

describe('MessagingComponent', () => {
  let component: MessagingComponent;
  let fixture: ComponentFixture<MessagingComponent>;
  let mockMessagingService: any;
  let telemetrySubject: Subject<any>;

  beforeEach(async () => {
    telemetrySubject = new Subject();
    mockMessagingService = {
      getSites: vi.fn(() => of([
        { id: 'site-1', name: 'Socorro', elements: ['VLA-1'] }
      ])),
      getAllElements: vi.fn(() => of([
        { id: 'VLA-1', siteId: 'site-1', status: 'operational' }
      ])),
      ensureConnected: vi.fn(),
      telemetry$: telemetrySubject.asObservable(),
      stats$: of({
        at: new Date().toISOString(),
        packetsPerSecond: 1,
        nodeToHubPerSecond: 1,
        hubToHubPerSecond: 0,
        rabbitPublishedPerSecond: 1,
        kafkaPublishedPerSecond: 1,
        persistentWritesPerSecond: 0,
        totals: {
          packets: 1,
          nodeToHub: 1,
          hubToHub: 0,
          rabbitPublished: 1,
          kafkaPublished: 1,
          persistentWrites: 0,
          errors: 0,
        },
        infra: {
          rabbitmq: { connected: true, latencyMs: 1, queueDepth: 0, consumers: 1 },
          kafka: { connected: true, latencyMs: 1, latestOffset: 1, partitions: 1 },
          storage: {
            postgres: { connected: true, latencyMs: 1 },
            redis: { connected: true, latencyMs: 1 },
          },
        },
      }),
      getLiveStats: vi.fn(() => of({
        at: new Date().toISOString(),
        packetsPerSecond: 1,
        nodeToHubPerSecond: 1,
        hubToHubPerSecond: 0,
        rabbitPublishedPerSecond: 1,
        kafkaPublishedPerSecond: 1,
        persistentWritesPerSecond: 0,
        totals: {
          packets: 1,
          nodeToHub: 1,
          hubToHub: 0,
          rabbitPublished: 1,
          kafkaPublished: 1,
          persistentWrites: 0,
          errors: 0,
        },
        infra: {
          rabbitmq: { connected: true, latencyMs: 1, queueDepth: 0, consumers: 1 },
          kafka: { connected: true, latencyMs: 1, latestOffset: 1, partitions: 1 },
          storage: {
            postgres: { connected: true, latencyMs: 1 },
            redis: { connected: true, latencyMs: 1 },
          },
        },
      })),
    };

    await TestBed.configureTestingModule({
      declarations: [MessagingComponent],
      imports: [CommonModule],
      providers: [
        { provide: MessagingService, useValue: mockMessagingService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MessagingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize D3 visualization', () => {
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('should render sites in sidebar', () => {
    const siteCards = fixture.nativeElement.querySelectorAll('.site-card');
    expect(siteCards.length).toBeGreaterThan(0);
  });

  it('should handle incoming telemetry', async () => {
    telemetrySubject.next({
      sourceId: 'VLA-1',
      targetId: 'site-1',
      routeType: 'node_to_hub',
      elementId: 'VLA-1',
      siteId: 'site-1',
      metrics: { strength: 0.9 },
      timestamp: new Date().toISOString()
    });

    await Promise.resolve();
    
    const element = component.elements.find(r => r.id === 'VLA-1');
    expect(element?.strength).toBe(0.9);
  });
});
