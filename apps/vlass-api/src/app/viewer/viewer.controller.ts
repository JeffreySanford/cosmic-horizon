import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ViewerService } from './viewer.service';
import { CreateViewerStateDto } from './dto/create-viewer-state.dto';
import { CreateViewerSnapshotDto } from './dto/create-viewer-snapshot.dto';
import { RateLimitGuard } from '../guards/rate-limit.guard';

@Controller('view')
export class ViewerController {
  constructor(private readonly viewerService: ViewerService) {}

  @Post('state')
  createState(@Body() body: CreateViewerStateDto) {
    return this.viewerService.createState(body.state);
  }

  @Post('snapshot')
  @UseGuards(RateLimitGuard)
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
  ): Promise<StreamableFile> {
    const ra = Number(raRaw);
    const dec = Number(decRaw);
    const fov = Number(fovRaw);
    const survey = typeof surveyRaw === 'string' ? surveyRaw : '';

    if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(fov) || survey.trim().length < 2) {
      throw new BadRequestException('ra, dec, fov, and survey query params are required.');
    }

    const result = await this.viewerService.downloadCutout({
      ra,
      dec,
      fov,
      survey,
      label: labelRaw,
      detail: detailRaw === 'high' || detailRaw === 'max' ? detailRaw : 'standard',
    });

    return new StreamableFile(result.buffer, {
      type: 'application/fits',
      disposition: `attachment; filename="${result.fileName}"`,
    });
  }

  @Get(':shortId')
  getState(@Param('shortId') shortId: string) {
    return this.viewerService.resolveState(shortId);
  }
}
