import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { ProfileService } from './profile.service';
import type { AuthenticatedRequest } from '../types/http.types';

@Controller('profiles')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':username')
  @UseGuards(RateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async getProfile(@Param('username') username: string) {
    return this.profileService.getProfile(username);
  }

  @Put('me')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async updateMyProfile(
    @Request() req: AuthenticatedRequest,
    @Body()
    updateData: { display_name?: string; bio?: string; avatar_url?: string },
  ) {
    return this.profileService.updateProfile(req.user.id, updateData);
  }
}
