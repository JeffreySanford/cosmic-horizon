import { Controller, Get } from '@nestjs/common';
import { SystemHealthMonitorService } from './services/system-health-monitor.service';

@Controller('health')
export class HealthController {
  constructor(private readonly monitor: SystemHealthMonitorService) {}

  @Get('alerts')
  getAlerts(): string[] {
    return this.monitor.getAlerts();
  }
}
