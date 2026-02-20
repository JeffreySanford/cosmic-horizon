import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { RequestContextService } from '../context/request-context.service';

// we avoid importing Express types here to satisfy eslint no-restricted-imports rule


/**
 * Middleware that ensures every HTTP request has an attached
 * X-Correlation-Id value and that it is available via
 * RequestContextService for the duration of the request.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationMiddleware.name);

  constructor(private readonly ctx: RequestContextService) {}

  use(
    req: { headers: Record<string, string | string[] | undefined> },
    res: { setHeader: (name: string, value: string) => void },
    next: () => void,
  ): void {
    const header = req.headers['x-correlation-id'];
    const corrFromHeader = Array.isArray(header) ? header[0] : header;

    // run callback inside ALS context so other code can read it
    this.ctx.run(() => {
      // grab the ID that ended up in the store (either header or generated)
      const active = this.ctx.getCorrelationId();
      if (active) {
        res.setHeader('X-Correlation-Id', active);
      }
      next();
    },
    // pass header id only if it exists and is a string
    corrFromHeader && typeof corrFromHeader === 'string'
      ? { correlationId: corrFromHeader }
      : undefined,
    );
  }
}
