import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TaccIntegrationService, TaccJobSubmission } from './tacc-integration.service';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import type { AuthenticatedRequest } from '../types/http.types';

@Controller('jobs')
export class JobsController {
  constructor(private readonly taccService: TaccIntegrationService) {}

  @Post('submit')
  @UseGuards(AuthenticatedGuard)
  async submitJob(@Request() req: AuthenticatedRequest, @Body() submission: TaccJobSubmission) {
    // Add audit log or validation here in a real app
    return this.taccService.submitJob(submission);
  }

  @Get(':id/status')
  @UseGuards(AuthenticatedGuard)
  async getJobStatus(@Param('id') jobId: string) {
    return this.taccService.getJobStatus(jobId);
  }

  @Delete(':id')
  @UseGuards(AuthenticatedGuard)
  async cancelJob(@Param('id') jobId: string) {
    return this.taccService.cancelJob(jobId);
  }
}
