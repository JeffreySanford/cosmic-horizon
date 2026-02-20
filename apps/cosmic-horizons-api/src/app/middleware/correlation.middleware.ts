import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContextService } from '../context/request-context.service';

/**
 * Middleware that ensures every HTTP request has an attached
 * X-Correlation-Id value and that it is available via
 * RequestContextService for the duration of the request.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationMiddleware.name);

  constructor(private readonly ctx: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
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
