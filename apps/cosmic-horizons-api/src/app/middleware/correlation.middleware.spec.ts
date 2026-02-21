import { CorrelationMiddleware } from './correlation.middleware';
import { RequestContextService } from '../context/request-context.service';

describe('CorrelationMiddleware', () => {
  let middleware: CorrelationMiddleware;
  let ctx: jest.Mocked<RequestContextService>;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    ctx = {
      run: jest.fn((cb: () => any) => cb()),
      getCorrelationId: jest.fn().mockReturnValue('generated-id' as any),
    } as unknown as jest.Mocked<RequestContextService>;

    middleware = new CorrelationMiddleware(ctx);

    req = { headers: {} };
    res = { setHeader: jest.fn() };
    next = jest.fn();
  });

  it('should generate and attach header when none present', () => {
    middleware.use(req, res, next);
    expect(ctx.run).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Correlation-Id',
      'generated-id',
    );
    expect(next).toHaveBeenCalled();
  });

  it('should use header value if provided', () => {
    req.headers['x-correlation-id'] = 'external-123';
    middleware.use(req, res, next);
    expect(ctx.run).toHaveBeenCalledWith(expect.any(Function), {
      correlationId: 'external-123',
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Correlation-Id',
      'generated-id',
    );
    expect(next).toHaveBeenCalled();
  });
});
