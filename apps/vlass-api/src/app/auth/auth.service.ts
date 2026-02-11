import { Injectable, BadRequestException, ConflictException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import Strategy from 'passport-github2';
import { UserRepository } from '../repositories';
import { CreateUserDto } from '../dto';
import { User } from '../entities';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';

export interface JwtPayload {
  sub: string;
  email: string | null;
  username: string;
  role: 'user' | 'admin' | 'moderator';
}

interface RefreshTokenRecord {
  id: string;
  user_id: string;
  expires_at: string | Date;
  revoked_at: string | Date | null;
}

export interface AuthTokenPair {
  access_token: string;
  refresh_token: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureUserRoleColumn();
    await this.ensureRefreshTokenTable();
    await this.cleanupExpiredRefreshTokens();
  }

  /**
   * Validate or create a user from GitHub OAuth profile
   */
  async validateOrCreateUser(profile: Strategy.Profile): Promise<User> {
    const {
      id: github_id,
      login: username,
      emails,
      displayName,
    } = profile;

    const display_name = displayName || username;
    const avatar_url = profile.photos?.[0]?.value || null;

    // Get primary email from GitHub
    const email = emails && emails.length > 0 ? emails[0].value : null;

    if (!email) {
      throw new BadRequestException(
        'GitHub account must have a public email. Please set one at github.com/settings/emails',
      );
    }

    // Find existing user by GitHub ID
    let user = await this.userRepository.findByGitHubId(github_id);

    if (!user) {
      // Create new user
      const createUserDto: CreateUserDto = {
        username,
        email,
        github_id,
        display_name,
        avatar_url,
      };

      user = await this.userRepository.create(createUserDto);
    } else {
      // Update user with latest profile info
      user.username = username;
      user.email = email;
      user.display_name = display_name;
      user.avatar_url = avatar_url;
      user.updated_at = new Date();
      await this.userRepository.save(user);
    }

    return user;
  }

  /**
   * Get current user from session
   */
  async getCurrentUser(userId: string): Promise<User | null> {
    if (!userId) return null;
    return this.userRepository.findOne({ where: { id: userId } });
  }

  async loginWithCredentials(credentials: LoginDto): Promise<User> {
    const email = credentials.email.trim().toLowerCase();
    const password = credentials.password;

    const user = await this.userRepository.findByEmailAndPassword(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }

  async registerWithCredentials(dto: RegisterDto): Promise<User> {
    const username = dto.username.trim();
    const email = dto.email.trim().toLowerCase();
    const password = dto.password;
    const display_name = dto.display_name?.trim() || username;

    if (username.length < 3) {
      throw new BadRequestException('Username must be at least 3 characters.');
    }

    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }

    const byUsername = await this.userRepository.findByUsername(username);
    if (byUsername) {
      throw new ConflictException('Username is already in use.');
    }

    const byEmail = await this.userRepository.findByEmail(email);
    if (byEmail) {
      throw new ConflictException('Email is already in use.');
    }

    return this.userRepository.createWithPassword({
      username,
      display_name,
      email,
      password,
    });
  }

  signToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  async issueAuthTokens(user: User): Promise<AuthTokenPair> {
    const accessToken = this.signToken(user);
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + this.refreshTokenLifetimeMs());

    await this.dataSource.query(
      `
        INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
      `,
      [user.id, refreshTokenHash, expiresAt.toISOString()],
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refreshAuthTokens(refreshToken: string): Promise<{ user: User; tokens: AuthTokenPair }> {
    const normalized = refreshToken.trim();
    if (!normalized) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashRefreshToken(normalized);
    const existing = await this.findRefreshTokenRecord(tokenHash);
    if (!existing) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    if (existing.revoked_at) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const expiresAt = new Date(existing.expires_at);
    if (Number.isNaN(expiresAt.valueOf()) || expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.getCurrentUser(existing.user_id);
    if (!user) {
      throw new UnauthorizedException('Refresh token user no longer exists');
    }

    await this.revokeRefreshTokenById(existing.id);
    const tokens = await this.issueAuthTokens(user);
    return { user, tokens };
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const normalized = refreshToken.trim();
    if (!normalized) {
      return;
    }

    const tokenHash = this.hashRefreshToken(normalized);
    await this.dataSource.query(
      `
        UPDATE auth_refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP, last_used_at = CURRENT_TIMESTAMP
        WHERE token_hash = $1 AND revoked_at IS NULL
      `,
      [tokenHash],
    );
  }

  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.dataSource.query(
      `
        UPDATE auth_refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP, last_used_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND revoked_at IS NULL
      `,
      [userId],
    );
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private refreshTokenLifetimeMs(): number {
    const days = Number(process.env['REFRESH_TOKEN_EXPIRES_IN_DAYS'] || 7);
    const safeDays = Number.isFinite(days) && days > 0 ? days : 7;
    return safeDays * 24 * 60 * 60 * 1000;
  }

  private async findRefreshTokenRecord(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const rows = (await this.dataSource.query(
      `
        SELECT id, user_id, expires_at, revoked_at
        FROM auth_refresh_tokens
        WHERE token_hash = $1
        LIMIT 1
      `,
      [tokenHash],
    )) as RefreshTokenRecord[];

    return rows[0] ?? null;
  }

  private async revokeRefreshTokenById(id: string): Promise<void> {
    await this.dataSource.query(
      `
        UPDATE auth_refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP, last_used_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND revoked_at IS NULL
      `,
      [id],
    );
  }

  private async cleanupExpiredRefreshTokens(): Promise<void> {
    await this.dataSource.query(
      `
        DELETE FROM auth_refresh_tokens
        WHERE expires_at < CURRENT_TIMESTAMP
           OR revoked_at < (CURRENT_TIMESTAMP - INTERVAL '30 days')
      `,
    );
  }

  private async ensureRefreshTokenTable(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(128) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP NULL,
        last_used_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_id ON auth_refresh_tokens(user_id);
    `);

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_expires_at ON auth_refresh_tokens(expires_at);
    `);
  }

  private async ensureUserRoleColumn(): Promise<void> {
    await this.dataSource.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'user';
    `);

    await this.dataSource.query(`
      UPDATE users
      SET role = 'user'
      WHERE role IS NULL;
    `);
  }
}
