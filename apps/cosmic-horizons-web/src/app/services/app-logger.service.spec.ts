import { TestBed } from '@angular/core/testing';
import { AppLoggerService } from './app-logger.service';
import { vi } from 'vitest';

describe('AppLoggerService', () => {
  let service: AppLoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppLoggerService);
    
    // Mock global fetch to prevent actual network requests
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should record an info log and attempt to sync to backend', async () => {
    const pushSpy = vi.spyOn(service as any, 'sendToBackend');
    
    service.info('test', 'event', { key: 'value' });
    
    const snapshot = service.snapshot();
    expect(snapshot.length).toBe(1);
    expect(snapshot[0].level).toBe('info');
    expect(pushSpy).toHaveBeenCalled();
  });

  it('should not sync debug logs to backend', () => {
    const pushSpy = vi.spyOn(service as any, 'sendToBackend');
    
    service.debug('test', 'debug-event');
    
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('should handle fetch errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    
    // Should not throw
    service.error('test', 'error-event');
    
    expect(global.fetch).toHaveBeenCalled();
  });
});
