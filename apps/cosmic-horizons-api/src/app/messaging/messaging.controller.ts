import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { ArraySite, ArrayElementStatus } from './messaging.types';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';

@Controller('messaging')
@UseGuards(AuthenticatedGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

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
}

