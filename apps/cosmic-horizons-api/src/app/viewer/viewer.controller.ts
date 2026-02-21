import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Request,
  StreamableFile,
  UseGuards,
  Res,
} from '@nestjs/common';
// avoid importing express types to keep eslint happy

import { ViewerService } from './viewer.service';
import { CreateViewerStateDto } from './dto/create-viewer-state.dto';
import { CreateViewerSnapshotDto } from './dto/create-viewer-snapshot.dto';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import type { RequestWithUser } from '../types/http.types';

@Controller('view')
export class ViewerController {
  constructor(private readonly viewerService: ViewerService) {}

  @Post('state')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  createState(@Body() body: CreateViewerStateDto) {
    return this.viewerService.createState(body.state);
  }

  @Post('snapshot')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  createSnapshot(@Body() body: CreateViewerSnapshotDto) {
    return this.viewerService.createSnapshot(body);
  }

  @Get('cutout')
  @UseGuards(RateLimitGuard)
  async downloadCutout(
    @Query('ra') raRaw: string,
    @Query('dec') decRaw: string,
    @Query('fov') fovRaw: string,
    @Query('survey') surveyRaw: string,
    @Query('label') labelRaw?: string,
    @Query('detail') detailRaw?: string,
    @Res({ passthrough: true })
    res?: { setHeader: (name: string, value: string) => void },
  ): Promise<StreamableFile> {
    if (res) {
      res.setHeader('Cache-Control', 'public, max-age=60');
    }
    const ra = Number(raRaw);
    const dec = Number(decRaw);
    const fov = Number(fovRaw);
    const survey = typeof surveyRaw === 'string' ? surveyRaw : '';

    if (
      !Number.isFinite(ra) ||
      !Number.isFinite(dec) ||
      !Number.isFinite(fov) ||
      survey.trim().length < 2
    ) {
      throw new BadRequestException(
        'ra, dec, fov, and survey query params are required.',
      );
    }

    const result = await this.viewerService.downloadCutout({
      ra,
      dec,
      fov,
      survey,
      label: labelRaw,
      detail:
        detailRaw === 'high' || detailRaw === 'max' ? detailRaw : 'standard',
    });

    return new StreamableFile(result.buffer, {
      type: 'application/fits',
      disposition: `attachment; filename="${result.fileName}"`,
    });
  }

  @Get('labels/nearby')
  @UseGuards(RateLimitGuard)
  async getNearbyLabels(
    @Query('ra') raRaw: string,
    @Query('dec') decRaw: string,
    @Query('radius') radiusRaw: string,
    @Query('limit') limitRaw?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    if (res) {
      res.setHeader('Cache-Control', 'public, max-age=30');
    }
    const ra = Number(raRaw);
    const dec = Number(decRaw);
    const radius = Number(radiusRaw);
    const limit = Number(limitRaw ?? '12');

    if (
      !Number.isFinite(ra) ||
      !Number.isFinite(dec) ||
      !Number.isFinite(radius)
    ) {
      throw new BadRequestException(
        'ra, dec, and radius query params are required.',
      );
    }

    if (radius <= 0 || radius > 2) {
      throw new BadRequestException('radius must be in (0, 2].');
    }

    if (!Number.isFinite(limit) || limit < 1 || limit > 25) {
      throw new BadRequestException('limit must be between 1 and 25.');
    }

    return this.viewerService.getNearbyLabels(
      ra,
      dec,
      radius,
      Math.floor(limit),
    );
  }

  @Get('telemetry')
  @UseGuards(AuthenticatedGuard)
  getCutoutTelemetry(@Request() req: RequestWithUser) {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException('Telemetry is restricted to admin users.');
    }

    return this.viewerService.getCutoutTelemetry();
  }

  @Get(':shortId')
  getState(@Param('shortId') shortId: string) {
    return this.viewerService.resolveState(shortId);
  }
}
