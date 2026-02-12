import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { LogSeverity, LogType } from './log-entry';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';

interface RemoteLogDto {
  type: LogType;
  severity: LogSeverity;
  message: string;
  data?: Record<string, string | number | boolean | null>;
}

@Controller('logging')
export class LoggingController {
  constructor(private readonly loggingService: LoggingService) {}

  @Post('remote')
  async addRemoteLog(@Body() log: RemoteLogDto) {
    await this.loggingService.add({
      type: 'remote',
      severity: log.severity,
      message: `[Frontend] ${log.message}`,
      data: log.data,
    });
    return { success: true };
  }
}
