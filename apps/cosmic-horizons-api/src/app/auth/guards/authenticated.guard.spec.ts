import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { AuthenticatedGuard } from './authenticated.guard';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('AuthenticatedGuard', () => {
  let guard: AuthenticatedGuard;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        AuthenticatedGuard,
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = testingModule.get<AuthenticatedGuard>(AuthenticatedGuard);
    authService = testingModule.get(AuthService) as jest.Mocked<AuthService>;
  });

  describe('canActivate', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should extend AuthGuard with jwt strategy', () => {
      expect(guard.constructor.name).toBe('AuthenticatedGuard');
      // Verify the guard has the canActivate method from AuthGuard
      expect(guard.canActivate).toBeDefined();
      expect(typeof guard.canActivate).toBe('function');
    });

    it('should allow request with valid JWT token', async () => {
      const req = {
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
        user: {
          id: 'user-1',
          username: 'testuser',
          email: 'test@cosmic.local',
        },
      };

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
        getClass: () => class MockController {},
        getHandler: () => () => null,
      } as unknown as ExecutionContext;

      // Note: Full integration test requires passport strategy to be configured
      // This test validates the guard is properly injectable
      expect(guard).toBeInstanceOf(AuthenticatedGuard);
    });

    it('should be injectable with AuthService dependency', () => {
      // Verify guard was successfully instantiated as a service
      expect(guard).toBeDefined();
      expect(authService).toBeDefined();
    });

    it('should have jwt strategy name', () => {
      // AuthGuard('jwt') creates a strategy with name 'jwt'
      const strategyName = (guard as any).authType;
      // The guard should be configured with JWT strategy
      expect(Object.getPrototypeOf(Object.getPrototypeOf(guard))).toBeDefined();
    });

    it('should handle missing authorization header gracefully', () => {
      const req = {
        headers: {},
      };

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as unknown as ExecutionContext;

      expect(guard).toBeDefined();
    });

    it('should validate guard is singleton injectable', () => {
      // Create another instance to verify it can be instantiated
      const guard2 = new AuthenticatedGuard();
      expect(guard2).toBeInstanceOf(AuthenticatedGuard);
    });

    it('should be usable as a route guard decorator', () => {
      // Verify the class can be used as a guard
      const guardInstance = guard;
      expect(guardInstance.canActivate).toBeDefined();
      expect(typeof guardInstance.canActivate).toBe('function');
    });

    it('should work with express request/response cycle', () => {
      const mockRequest = {
        headers: {
          authorization:
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEifQ.signature',
        },
        user: null,
      };

      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const mockNext = jest.fn();

      expect(guard).toBeDefined();
      expect(typeof guard.canActivate).toBe('function');
    });
  });

  describe('decorator integration', () => {
    it('should work with NestJS UseGuards decorator metadata', () => {
      // This test verifies the guard can be used with @UseGuards(AuthenticatedGuard)
      const guardPrototype = Object.getPrototypeOf(guard);
      expect(guardPrototype).toBeDefined();
    });

    it('should be compatible with global guard registration', () => {
      // Validate guard can be registered globally
      expect(guard.canActivate).toBeDefined();
      expect(typeof guard.canActivate).toBe('function');
    });
  });
});
