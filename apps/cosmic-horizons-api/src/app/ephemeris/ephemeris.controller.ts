import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EphemerisService } from './ephemeris.service';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { EphemerisSearchDto } from './dto/ephemeris-search.dto';

@Controller('view/ephem')
export class EphemerisController {
  constructor(private readonly ephemerisService: EphemerisService) {}

  @Get('search')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async search(@Query() query: EphemerisSearchDto) {
    const target = (query.target || query.object_name || '').trim();

    if (!target) {
      throw new NotFoundException('Target name is required.');
    }

    const result = await this.ephemerisService.calculatePosition(
      target,
      query.epoch || new Date().toISOString()
    );

    if (!result) {
      throw new NotFoundException(`Object "${target}" not found or calculation failed.`);
    }

    return result;
  }
}
