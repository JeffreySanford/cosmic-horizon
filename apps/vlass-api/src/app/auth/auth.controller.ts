import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  UseGuards,
  Request,
  Response,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuditAction, AuditEntityType, User } from '../entities';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthenticatedGuard } from './guards/authenticated.guard';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { randomBytes } from 'node:crypto';
import { RequestWithUser, ResponseWithJsonAndRedirect } from '../types/http.types';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Request() req?: RequestWithUser) {
    const user = await this.authService.registerWithCredentials(registerDto);
    const tokens = await this.authService.issueAuthTokens(user);
    await this.writeAuthAudit(req, user, AuditAction.LOGIN, {
      auth_event: 'register_auto_login',
      auth_method: 'password',
    });
    return this.buildAuthResponse(user, tokens.access_token, tokens.refresh_token);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Request() req?: RequestWithUser) {
    const user = await this.authService.loginWithCredentials(loginDto);
    const tokens = await this.authService.issueAuthTokens(user);
    await this.writeAuthAudit(req, user, AuditAction.LOGIN, {
      auth_event: 'login',
      auth_method: 'password',
    });
    return this.buildAuthResponse(user, tokens.access_token, tokens.refresh_token);
  }

  @Post('refresh')
  async refresh(@Body() refreshDto: RefreshTokenDto) {
    const { user, tokens } = await this.authService.refreshAuthTokens(refreshDto.refresh_token);
    return this.buildAuthResponse(user, tokens.access_token, tokens.refresh_token);
  }

  /**
   * Initiates GitHub OAuth flow
   * Redirects to GitHub login
   */
  @Get('login')
  @UseGuards(AuthGuard('github'))
  gitHubLogin() {
    // Passport redirects to GitHub
  }

  /**
   * GitHub OAuth callback endpoint
   * Called by GitHub after user approves access
   */
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async gitHubCallback(@Request() req: RequestWithUser, @Response() res: ResponseWithJsonAndRedirect) {
    if (!req.user) {
      throw new BadRequestException('Authentication failed');
    }

    // At this point, user is authenticated and session is created
    // Redirect to frontend with success
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:4200';
    res.redirect(`${frontendUrl}/dashboard`);
  }

  /**
   * Get current authenticated user
   */
  @Get('me')
  @UseGuards(AuthenticatedGuard)
  getCurrentUser(@Request() req: RequestWithUser) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }

    const user = req.user;
    return {
      authenticated: true,
      user: {
        id: user.id,
        username: user.username ?? null,
        email: user.email ?? null,
        display_name: user.display_name ?? null,
        role: user.role ?? null,
        github_id: user.github_id ?? null,
        created_at: user.created_at ?? null,
      },
    };
  }

  @Get('csrf-token')
  csrfToken(@Request() req: RequestWithUser) {
    const sessionRequest = req;
    const csrfToken =
      sessionRequest.session?.csrfToken ?? randomBytes(24).toString('base64url');

    if (sessionRequest.session) {
      sessionRequest.session.csrfToken = csrfToken;
    }

    return { csrf_token: csrfToken };
  }

  /**
   * Logout endpoint
   */
  @Post('logout')
  @UseGuards(AuthenticatedGuard)
  async logout(
    @Request() req: RequestWithUser,
    @Response() res: ResponseWithJsonAndRedirect,
    @Body() refreshDto?: RefreshTokenDto,
  ) {
    if (!req.logout) {
      throw new BadRequestException('Logout is not available on this request.');
    }
    const logout = req.logout;

    await new Promise<void>((resolve, reject) => {
      logout((err: Error | null) => {
        if (err) {
          this.logger.warn(`Logout failed: ${err.message}`);
          reject(err);
          return;
        }
        resolve();
      });
    });

    if (req.user) {
      const userId = String(req.user.id);
      await this.authService.revokeAllRefreshTokensForUser(userId);
      const metadata = this.getRequestMetadata(req);
      await this.auditLogRepository.createAuditLog({
        user_id: userId,
        action: AuditAction.LOGOUT,
        entity_type: AuditEntityType.USER,
        entity_id: userId,
        changes: {
          auth_event: 'logout',
          auth_method: 'jwt',
        },
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent,
      });
    }

    if (refreshDto?.refresh_token) {
      await this.authService.revokeRefreshToken(refreshDto.refresh_token);
    }

    res.json({ message: 'Logged out successfully' });
  }

  private buildAuthResponse(user: User, accessToken: string, refreshToken: string) {
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer' as const,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        created_at: user.created_at,
      },
    };
  }

  private async writeAuthAudit(
    req: RequestWithUser | undefined,
    user: User,
    action: AuditAction.LOGIN | AuditAction.LOGOUT,
    changes: Record<string, unknown>,
  ): Promise<void> {
    const metadata = this.getRequestMetadata(req);
    await this.auditLogRepository.createAuditLog({
      user_id: user.id,
      action,
      entity_type: AuditEntityType.USER,
      entity_id: user.id,
      changes,
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
    });
  }

  private getRequestMetadata(
    req: RequestWithUser | undefined,
  ): { ip_address: string | null; user_agent: string | null } {
    if (!req) {
      return {
        ip_address: null,
        user_agent: null,
      };
    }

    return {
      ip_address: req.ip ?? null,
      user_agent:
        typeof req.headers?.['user-agent'] === 'string'
          ? req.headers['user-agent']
          : null,
    };
  }
}
