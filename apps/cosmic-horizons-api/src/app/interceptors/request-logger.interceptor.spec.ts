import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { RequestLoggerInterceptor } from './request-logger.interceptor';
import { LoggingService } from '../logging/logging.service';
import { of } from 'rxjs';

describe('RequestLoggerInterceptor', () => {
  let interceptor: RequestLoggerInterceptor;
  let loggingService: jest.Mocked<LoggingService>;
  let executionContext: jest.Mocked<ExecutionContext>;
  let callHandler: jest.Mocked<CallHandler>;

  beforeEach(async () => {
    loggingService = {
      add: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LoggingService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestLoggerInterceptor,
        {
          provide: LoggingService,
          useValue: loggingService,
        },
      ],
    }).compile();

    interceptor = module.get<RequestLoggerInterceptor>(RequestLoggerInterceptor);

    executionContext = {
      switchToHttp: jest.fn(),
    } as unknown as jest.Mocked<ExecutionContext>;

    callHandler = {
      handle: jest.fn(),
    } as unknown as jest.Mocked<CallHandler>;
  });

  describe('successful requests', () => {
    it('should log successful HTTP response', (done) => {
      const mockRequest = {
        method: 'GET',
        url: '/api/users',
        headers: { 'content-length': '0' },
        user: { id: 'user-1', email: 'user@example.com', role: 'user' },
      };

      const mockResponse = {
        statusCode: 200,
      };

      executionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      } as any);

      callHandler.handle.mockReturnValue(of(mockResponse));

      interceptor.intercept(executionContext, callHandler).subscribe(() => {
        expect(loggingService.add).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'http',
            severity: 'info',
            message: 'http_response',
            data: expect.objectContaining({
              event: 'http_response',
              method: 'GET',
              url: '/api/users',
              status_code: 200,
              user_id: 'user-1',
              user_role: 'user',
            }),
          }),
        );
        done();
      });
    });

    it('should log POST request with request body size', (done) => {
      const mockRequest = {
        method: 'POST',
        url: '/api/comments',
        headers: { 'content-length': '1024' },
        user: { id: 'user-2', role: 'user' },
      };

      const mockResponse = {
        statusCode: 201,
      };

      executionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      } as any);

      callHandler.handle.mockReturnValue(of(mockResponse));

      interceptor.intercept(executionContext, callHandler).subscribe(() => {
        expect(loggingService.add).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              method: 'POST',
              status_code: 201,
              request_bytes: 1024,
            }),
          }),
        );
        done();
      });
    });

    it('should log requests from anonymous users', (done) => {
      const mockRequest = {
        method: 'GET',
        url: '/api/public/data',
        headers: {},
      };

      const mockResponse = {
        statusCode: 200,
      };

      executionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      } as any);

      callHandler.handle.mockReturnValue(of(mockResponse));

      interceptor.intercept(executionContext, callHandler).subscribe(() => {
        expect(loggingService.add).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              user_id: 'anonymous',
              user_role: 'unknown',
            }),
          }),
        );
        done();
      });
    });

    it('should include duration in milliseconds', (done) => {
      const mockRequest = {
        method: 'GET',
        url: '/api/slow-endpoint',
        headers: {},
      };

      const mockResponse = {
        statusCode: 200,
      };

      executionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      } as any);

      callHandler.handle.mockReturnValue(of(mockResponse));

      interceptor.intercept(executionContext, callHandler).subscribe(() => {
        expect(loggingService.add).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              duration_ms: expect.any(Number),
            }),
          }),
        );
        done();
      });
    });

    it('should handle different HTTP methods', (done) => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      let completed = 0;

      methods.forEach((method) => {
        const mockRequest = {
          method,
          url: '/api/test',
          headers: {},
        };

        const mockResponse = {
          statusCode: method === 'DELETE' ? 204 : 200,
        };

        executionContext.switchToHttp.mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
          getResponse: jest.fn().mockReturnValue(mockResponse),
        } as any);

        callHandler.handle.mockReturnValue(of(mockResponse));

        interceptor.intercept(executionContext, callHandler).subscribe(() => {
          expect(loggingService.add).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                method,
              }),
            }),
          );
          completed++;
          if (completed === methods.length) {
            done();
          }
        });
      });
    });

    it('should handle admin users correctly', (done) => {
      const mockRequest = {
        method: 'GET',
        url: '/api/admin/logs',
        headers: {},
        user: { id: 'admin-1', role: 'admin', email: 'admin@example.com' },
      };

      const mockResponse = {
        statusCode: 200,
      };

      executionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      } as any);

      callHandler.handle.mockReturnValue(of(mockResponse));

      interceptor.intercept(executionContext, callHandler).subscribe(() => {
        expect(loggingService.add).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              user_role: 'admin',
              user_id: 'admin-1',
            }),
          }),
        );
        done();
      });
    });

    it('should handle response without statusCode property', (done) => {
      const mockRequest = {
        method: 'GET',
        url: '/api/test',
        headers: {},
      };

      const mockResponse = {};

      executionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      } as any);

      callHandler.handle.mockReturnValue(of(mockResponse));

      interceptor.intercept(executionContext, callHandler).subscribe(() => {
        expect(loggingService.add).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status_code: 200,
            }),
          }),
        );
        done();
      });
    });
  });

  describe('correlation tracking', () => {
    it('should include correlation ID in logs', (done) => {
      const mockRequest = {
        method: 'GET',
        url: '/api/trace',
        headers: {},
      };

      const mockResponse = {
        statusCode: 200,
      };

      executionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      } as any);

      callHandler.handle.mockReturnValue(of(mockResponse));

      interceptor.intercept(executionContext, callHandler).subscribe(() => {
        expect(loggingService.add).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              correlation_id: expect.any(String),
            }),
          }),
        );
        done();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle missing content-length header', (done) => {
      const mockRequest = {
        method: 'GET',
        url: '/api/test',
        headers: {},
      };

      const mockResponse = {
        statusCode: 200,
      };

      executionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      } as any);

      callHandler.handle.mockReturnValue(of(mockResponse));

      interceptor.intercept(executionContext, callHandler).subscribe(() => {
        expect(loggingService.add).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              request_bytes: null,
            }),
          }),
        );
        done();
      });
    });

    it('should handle array content-length header', (done) => {
      const mockRequest = {
        method: 'GET',
        url: '/api/test',
        headers: { 'content-length': ['512'] },
      };

      const mockResponse = {
        statusCode: 200,
      };

      executionContext.switchToHttp.mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      } as any);

      callHandler.handle.mockReturnValue(of(mockResponse));

      interceptor.intercept(executionContext, callHandler).subscribe(() => {
        expect(loggingService.add).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              request_bytes: 512,
            }),
          }),
        );
        done();
      });
    });
  });
});
