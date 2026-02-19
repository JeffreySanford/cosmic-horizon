import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GitHubStrategy } from './strategies/github.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SessionSerializer } from './strategies/session.serializer';
import { DatabaseModule } from '../database.module';
import { getJwtSecret } from '../config/security.config';

function resolveJwtExpiresInSeconds(): number {
  const raw = process.env['JWT_EXPIRES_IN'];
  if (!raw) {
    return 15 * 60;
  }

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber;
  }

  const match = /^(\d+)([smhd])$/i.exec(raw.trim());
  if (!match) {
    return 15 * 60;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplierByUnit: Record<'s' | 'm' | 'h' | 'd', number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };
  return amount * multiplierByUnit[unit as 's' | 'm' | 'h' | 'd'];
}

const jwtExpiresInSeconds = resolveJwtExpiresInSeconds();

@Module({
  imports: [
    PassportModule.register({ session: true }),
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: {
        expiresIn: jwtExpiresInSeconds,
      },
    }),
    DatabaseModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, GitHubStrategy, JwtStrategy, SessionSerializer],
  exports: [AuthService, PassportModule, JwtModule],
})
export class AuthModule {}
