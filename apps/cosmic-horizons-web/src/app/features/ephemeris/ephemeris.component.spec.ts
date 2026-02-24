import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EphemerisComponent } from './ephemeris.component';
import { AuthSessionService } from '../../services/auth-session.service';
import { AppLoggerService } from '../../services/app-logger.service';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('EphemerisComponent', () => {
  let component: EphemerisComponent;
  let fixture: ComponentFixture<EphemerisComponent>;

  const mockResponse = {
    target: 'mars',
    ra: 327.111647000442,
    dec: -14.403691179562493,
    accuracy_arcsec: 0.1,
    epoch: '2026-02-24T00:00:54.703Z',
    sky_preview_url: '',
    object_type: 'planet',
    source: 'astronomy-engine',
    aladin_url: ''
  } as any;

  const mockEphemerisService = {
    search: () => of(mockResponse),
  };

  const mockLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };
  const mockAuth = { getUser: () => ({ username: 'tester' }) };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      declarations: [EphemerisComponent],
      providers: [
        { provide: AuthSessionService, useValue: mockAuth },
        { provide: AppLoggerService, useValue: mockLogger },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });

    fixture = TestBed.createComponent(EphemerisComponent);
    component = fixture.componentInstance;
    // wire the service directly on the instance to avoid DI token mismatch
    (component as any).ephemerisApiService = mockEphemerisService;
    (component as any).logger = mockLogger;
    (component as any).authSessionService = mockAuth;
  });

  it('should display results card when result is set', () => {
    component.result = mockResponse as any;
    component.previewImageUrl = '';
    fixture.detectChanges();

    expect(component.result).toBeTruthy();
    const el = fixture.nativeElement.querySelector('.results-card');
    expect(el).toBeTruthy();
  });
});
