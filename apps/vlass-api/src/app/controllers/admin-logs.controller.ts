import { Controller, Get, Query } from '@nestjs/common';
import { LoggingService } from '../logging/logging.service';
import { LogEntry } from '../logging/log-entry';

interface LogsResponse {
  data: LogEntry[];
  total: number;
}

@Controller('admin/logs')
export class AdminLogsController {
  constructor(private readonly logging: LoggingService) {}

  @Get()
  async list(
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ): Promise<LogsResponse> {
    const parsedOffset = Number(offset ?? 0);
    const parsedLimit = Number(limit ?? 100);
    const safeOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 && parsedLimit <= 500 ? parsedLimit : 100;
    const data = await this.logging.getRecent(safeLimit, safeOffset);
    return { data, total: data.length };
  }

  @Get('summary')
  async summary(): Promise<Record<string, number>> {
    return this.logging.getSummary();
  }
}
