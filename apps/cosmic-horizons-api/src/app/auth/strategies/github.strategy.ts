import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github';
import { AuthService } from '../auth.service';
import { User } from '../../entities';

function readGitHubOAuthEnv(
  name: 'GITHUB_CLIENT_ID' | 'GITHUB_CLIENT_SECRET',
): string {
  const raw = process.env[name];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }

  throw new Error(`${name} is required for GitHub OAuth.`);
}

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    const strategyOptions: Strategy.StrategyOptions = {
      clientID: readGitHubOAuthEnv('GITHUB_CLIENT_ID'),
      clientSecret: readGitHubOAuthEnv('GITHUB_CLIENT_SECRET'),
      callbackURL:
        process.env['GITHUB_CALLBACK_URL'] ||
        'http://localhost:3000/api/auth/github/callback',
      scope: ['user:email'],
    };
    super(strategyOptions);
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Strategy.Profile,
  ): Promise<User> {
    const user = await this.authService.validateOrCreateUser(profile);
    return user;
  }
}
