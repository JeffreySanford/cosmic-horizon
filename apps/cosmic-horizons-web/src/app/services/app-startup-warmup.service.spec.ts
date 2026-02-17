import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { BrokerDataService } from '../modules/operations/broker-comparison/services/broker-data.service';
import { AppStartupWarmupService } from './app-startup-warmup.service';
import { AuthSessionService } from './auth-session.service';

describe('AppStartupWarmupService', () => {
  it('should warm broker metrics for admin role in browser', () => {
    const brokerDataService = {
      getCurrentMetrics: vi.fn().mockReturnValue(of(undefined)),
    };
    const authSessionService = {
      getRole: vi.fn().mockReturnValue('admin'),
    };

    TestBed.configureTestingModule({
      providers: [
        AppStartupWarmupService,
        { provide: BrokerDataService, useValue: brokerDataService },
        { provide: AuthSessionService, useValue: authSessionService },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    const service = TestBed.inject(AppStartupWarmupService);
    service.warmUp();

    expect(brokerDataService.getCurrentMetrics).toHaveBeenCalledTimes(1);
  });

  it('should skip warmup for non-admin roles', () => {
    const brokerDataService = {
      getCurrentMetrics: vi.fn().mockReturnValue(of(undefined)),
    };
    const authSessionService = {
      getRole: vi.fn().mockReturnValue('user'),
    };

    TestBed.configureTestingModule({
      providers: [
        AppStartupWarmupService,
        { provide: BrokerDataService, useValue: brokerDataService },
        { provide: AuthSessionService, useValue: authSessionService },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    const service = TestBed.inject(AppStartupWarmupService);
    service.warmUp();

    expect(brokerDataService.getCurrentMetrics).not.toHaveBeenCalled();
  });

  it('should swallow warmup errors', () => {
    const brokerDataService = {
      getCurrentMetrics: vi.fn().mockReturnValue(throwError(() => new Error('warmup failed'))),
    };
    const authSessionService = {
      getRole: vi.fn().mockReturnValue('admin'),
    };

    TestBed.configureTestingModule({
      providers: [
        AppStartupWarmupService,
        { provide: BrokerDataService, useValue: brokerDataService },
        { provide: AuthSessionService, useValue: authSessionService },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    const service = TestBed.inject(AppStartupWarmupService);
    expect(() => service.warmUp()).not.toThrow();
    expect(brokerDataService.getCurrentMetrics).toHaveBeenCalledTimes(1);
  });
});
