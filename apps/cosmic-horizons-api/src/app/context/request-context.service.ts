import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { UUID, generateCorrelationId, createUUID } from '@cosmic-horizons/event-models';

/**
 * Simple request-scoped context container using AsyncLocalStorage.
 *
 * Right now we only store a correlation ID, but this can be extended to
 * include user/session information or other metadata that needs to ride
 * along the lifetime of a request (and any async work spawned from it).
 */
export interface RequestContext {
  correlationId: UUID;
}

@Injectable()
export class RequestContextService {
  private readonly als = new AsyncLocalStorage<RequestContext>();

  /**
   * Run a callback within a context.  If a correlationId is provided it will
   * be used; otherwise a fresh one is generated.
   */
  run<T>(callback: (...args: unknown[]) => T, context: Partial<RequestContext> = {}): T {
    const store: RequestContext = {
      correlationId: context.correlationId ?? generateCorrelationId(),
    } as RequestContext;
    return this.als.run(store, callback as any);
  }

  /**
   * Returns the correlation ID for the current execution context, or undefined
   * if no context is active.
   */
  getCorrelationId(): UUID | undefined {
    return this.als.getStore()?.correlationId;
  }

  /**
   * Convenience helper to set a correlation id in the current store.  This is
   * typically only useful for tests or if you need to mutate the context.
   */
  setCorrelationId(id: string): void {
    const store = this.als.getStore();
    if (store) {
      store.correlationId = createUUID(id);
    }
  }
}
