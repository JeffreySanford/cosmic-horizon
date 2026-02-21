import { RequestContextService } from './request-context.service';

describe('RequestContextService', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  it('should generate a correlation id when running without one', () => {
    let seen: string | undefined;
    service.run(() => {
      seen = service.getCorrelationId();
    });
    expect(seen).toBeDefined();
    expect(typeof seen).toBe('string');
    // subsequent call outside run should be undefined
    expect(service.getCorrelationId()).toBeUndefined();
  });

  it('should preserve supplied correlation id', () => {
    const provided = '00000000-0000-4000-8000-000000000000';
    let seen: string | undefined;
    service.run(
      () => {
        seen = service.getCorrelationId();
      },
      { correlationId: provided as any },
    );
    expect(seen).toBe(provided);
  });

  it('should allow setting correlation id after run', () => {
    let seen1: string | undefined;
    service.run(() => {
      seen1 = service.getCorrelationId();
      service.setCorrelationId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
      expect(service.getCorrelationId()).toBe(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      );
    });
    expect(seen1).toBeDefined();
  });
});
