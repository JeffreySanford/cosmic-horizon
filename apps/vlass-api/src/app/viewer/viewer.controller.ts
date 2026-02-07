import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ViewerService } from './viewer.service';
import { CreateViewerStateDto } from './dto/create-viewer-state.dto';
import { CreateViewerSnapshotDto } from './dto/create-viewer-snapshot.dto';

@Controller('view')
export class ViewerController {
  constructor(private readonly viewerService: ViewerService) {}

  @Post('state')
  createState(@Body() body: CreateViewerStateDto) {
    return this.viewerService.createState(body.state);
  }

  @Get(':shortId')
  getState(@Param('shortId') shortId: string) {
    return this.viewerService.resolveState(shortId);
  }

  @Post('snapshot')
  createSnapshot(@Body() body: CreateViewerSnapshotDto) {
    return this.viewerService.createSnapshot(body);
  }
}
