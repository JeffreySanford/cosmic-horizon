import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github';
import { AuthService } from '../auth.service';
import { User } from '../../entities';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    const strategyOptions: Strategy.StrategyOptions = {
      clientID: process.env['GITHUB_CLIENT_ID'],
      clientSecret: process.env['GITHUB_CLIENT_SECRET'],
      callbackURL: process.env['GITHUB_CALLBACK_URL'] || 'http://localhost:3001/api/auth/github/callback',
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
