import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessagingComponent } from './messaging.component';
import { MessagingService } from '../../services/messaging.service';
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
      telemetry$: telemetrySubject.asObservable()
    };

    await TestBed.configureTestingModule({
      imports: [ MessagingComponent ],
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
      elementId: 'VLA-1',
      siteId: 'site-1',
      metrics: { strength: 0.9 },
      timestamp: new Date().toISOString()
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    
    const element = component.elements.find(r => r.id === 'VLA-1');
    expect(element?.strength).toBe(0.9);
  });
});
