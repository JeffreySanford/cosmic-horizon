import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import type { ArraySite, ArrayElementStatus, MessagingLiveStats } from './messaging.types';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { MessagingMonitorService } from './messaging-monitor.service';
import { MessagingStatsService } from './messaging-stats.service';

@Controller('messaging')
@UseGuards(AuthenticatedGuard)
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly monitorService: MessagingMonitorService,
    private readonly statsService: MessagingStatsService,
  ) {}

  @Get('sites')
  getSites(): ArraySite[] {
    return this.messagingService.getSites();
  }

  @Get('elements')
  getAllElements(): ArrayElementStatus[] {
    return this.messagingService.getAllElements();
  }

  @Get('sites/:siteId/elements')
  getElementsBySite(@Param('siteId') siteId: string): ArrayElementStatus[] {
    return this.messagingService.getElementsBySite(siteId);
  }

  @Get('stats')
  getLiveStats(): MessagingLiveStats {
    return this.statsService.getSnapshot(this.monitorService.getSnapshot());
  }
}

