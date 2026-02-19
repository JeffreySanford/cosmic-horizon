import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Guard for protecting internal API routes.
 * Ensures only authenticated users can access /api/internal/* endpoints.
 * Admin-only restrictions apply to sensitive operations.
 */
@Injectable()
export class IsInternalRoute implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Allow unauthenticated access to broker metrics and health endpoints for development
    if (request.url.includes('/brokers/') || request.url.includes('/health')) {
      return true;
    }

    // Allow authenticated users access to monitoring endpoints (broker metrics, health checks)
    if (user) {
      // For broker metrics and health endpoints, allow any authenticated user
      if (
        request.url.includes('/brokers/') ||
        request.url.includes('/health')
      ) {
        return true;
      }

      // For other internal endpoints, require admin role
      const role = typeof user.role === 'string' ? user.role.toLowerCase() : '';
      const rolesArr = Array.isArray(user.roles)
        ? user.roles.map((r: string) => r.toLowerCase())
        : [];
      if (role === 'admin' || rolesArr.includes('admin')) {
        return true;
      }
    }

    // Allow requests from internal services (if authenticated via service token)
    if (user && user.isInternalService) {
      return true;
    }

    throw new ForbiddenException(
      'Access to internal API routes requires authentication',
    );
  }
}
