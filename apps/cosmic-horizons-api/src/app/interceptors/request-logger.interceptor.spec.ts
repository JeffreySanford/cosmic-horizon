import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { RequestLoggerInterceptor } from './request-logger.interceptor';
import { RequestContextService } from '../context/request-context.service';
import { LoggingService } from '../logging/logging.service';
import { of, firstValueFrom } from 'rxjs';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('RequestLoggerInterceptor', () => {
  let interceptor: RequestLoggerInterceptor;
  let loggingService: jest.Mocked<LoggingService>;
  let ctxService: jest.Mocked<RequestContextService>;
  let executionContext: jest.Mocked<ExecutionContext>;
  let callHandler: jest.Mocked<CallHandler>;

  beforeEach(async () => {
    loggingService = {
      add: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LoggingService>;

    ctxService = {
      getCorrelationId: jest.fn().mockReturnValue('cid-123' as any),
    } as unknown as jest.Mocked<RequestContextService>;

    testingModule = await Test.createTestingModule({
      providers: [
        RequestLoggerInterceptor,
        {
          provide: LoggingService,
          useValue: loggingService,
        },
        {
          provide: RequestContextService,
          useValue: ctxService,
        },
      ],
    }).compile();

    interceptor = testingModule.get<RequestLoggerInterceptor>(
      RequestLoggerInterceptor,
    );

    executionContext = {
      switchToHttp: jest.fn(),
    } as unknown as jest.Mocked<ExecutionContext>;

    callHandler = {
      handle: jest.fn().mockReturnValue(of({})),
    } as unknown as jest.Mocked<CallHandler>;
  });

  describe('successful requests', () => {
    it('should log successful HTTP response', async () => {
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

      await firstValueFrom(
        interceptor.intercept(executionContext, callHandler),
      );
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
            correlation_id: 'cid-123',
          }),
        }),
      );
    });

    it('should log POST request with request body size', async () => {
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

      await firstValueFrom(
        interceptor.intercept(executionContext, callHandler),
      );
      expect(loggingService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            method: 'POST',
            status_code: 201,
            request_bytes: 1024,
          }),
        }),
      );
    });

    it('should log requests from anonymous users', async () => {
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

      await firstValueFrom(
        interceptor.intercept(executionContext, callHandler),
      );
      expect(loggingService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 'anonymous',
            user_role: 'unknown',
          }),
        }),
      );
    });

    it('should include duration in milliseconds', async () => {
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

      await firstValueFrom(
        interceptor.intercept(executionContext, callHandler),
      );
      expect(loggingService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            duration_ms: expect.any(Number),
          }),
        }),
      );
    });

    it('should handle different HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
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

        await firstValueFrom(
          interceptor.intercept(executionContext, callHandler),
        );
        expect(loggingService.add).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              method,
            }),
          }),
        );
      }
    });

    it('should handle admin users correctly', async () => {
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

      await firstValueFrom(
        interceptor.intercept(executionContext, callHandler),
      );
      expect(loggingService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_role: 'admin',
            user_id: 'admin-1',
          }),
        }),
      );
    });

    it('should handle response without statusCode property', async () => {
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

      await firstValueFrom(
        interceptor.intercept(executionContext, callHandler),
      );
      expect(loggingService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status_code: 200,
          }),
        }),
      );
    });
  });

  describe('correlation tracking', () => {
    it('should include correlation ID in logs', async () => {
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

      await firstValueFrom(
        interceptor.intercept(executionContext, callHandler),
      );
      expect(loggingService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            correlation_id: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle missing content-length header', async () => {
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

      await firstValueFrom(
        interceptor.intercept(executionContext, callHandler),
      );
      expect(loggingService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            request_bytes: null,
          }),
        }),
      );
    });

    it('should handle array content-length header', async () => {
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

      await firstValueFrom(
        interceptor.intercept(executionContext, callHandler),
      );
      expect(loggingService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            request_bytes: 512,
          }),
        }),
      );
    });
  });
});
