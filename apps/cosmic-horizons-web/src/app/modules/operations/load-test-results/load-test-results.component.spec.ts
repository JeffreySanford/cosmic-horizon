import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoadTestResultsComponent } from './load-test-results.component';

describe('LoadTestResultsComponent', () => {
  let component: LoadTestResultsComponent;
  let fixture: ComponentFixture<LoadTestResultsComponent>;

  beforeEach(async () => {
    // default stub for fetch; tests can override if needed
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({}),
    }));

    await TestBed.configureTestingModule({
      imports: [LoadTestResultsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadTestResultsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads JSON from assets and assigns results', async () => {
    const fake = { connected: 3, failed: 1 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve(fake),
    }));

    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    expect(component.results).toEqual(fake);
  });});
