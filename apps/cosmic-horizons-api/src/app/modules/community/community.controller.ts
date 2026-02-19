import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommunityService } from './community.service';
import { CreateDiscoveryDto } from './dto/create-discovery.dto';
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard';
import type { AuthenticatedRequest } from '../../types/http.types';

/**
 * Minimal prototype controller for Community Discoveries
 * - GET  /api/community/feed       -> returns recent discoveries
 * - POST /api/community/posts      -> create a new discovery (no auth for prototype)
 */
@Controller('community')
@ApiTags('Community - Discoveries')
export class CommunityController {
  private readonly logger = new Logger(CommunityController.name);

  constructor(private readonly communityService: CommunityService) {}

  @Get('feed')
  @ApiOperation({ summary: 'Get recent community discoveries (prototype)' })
  @ApiResponse({ status: 200, description: 'Feed returned' })
  async getFeed() {
    return this.communityService.getFeed(50);
  }

  @Get('posts/pending')
  @UseGuards(AuthenticatedGuard)
  @ApiOperation({ summary: 'Get pending (hidden) discoveries (admin/dev)' })
  @ApiResponse({ status: 200, description: 'Pending discoveries' })
  async getPending(@Request() req: AuthenticatedRequest) {
    if (req.user?.role !== 'admin' && req.user?.role !== 'moderator') {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.communityService.getPendingFeed(100);
  }

  @Post('posts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a discovery (prototype, supports dev-only moderation flags)',
  })
  @ApiResponse({ status: 201, description: 'Discovery created' })
  async createPost(
    @Body() payload: CreateDiscoveryDto,
    @Query('forceHidden') forceHidden?: string,
    @Query('autoApprove') autoApprove?: string,
  ) {
    const opts = {
      forceHidden: forceHidden === 'true',
      autoApprove: autoApprove === 'true',
    };

    try {
      const created = await this.communityService.createDiscovery(
        payload,
        opts,
      );
      return created;
    } catch (err) {
      this.logger.error('createPost failed', err as Error);
      throw err;
    }
  }

  @Patch('posts/:id/approve')
  @UseGuards(AuthenticatedGuard)
  @ApiOperation({ summary: 'Approve a discovery (dev/admin action)' })
  @ApiResponse({ status: 200, description: 'Discovery approved and published' })
  async approvePost(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    if (req.user?.role !== 'admin' && req.user?.role !== 'moderator') {
      throw new ForbiddenException('Insufficient permissions');
    }

    const approved = await this.communityService.approveDiscovery(
      id,
      req.user?.id ?? null,
    );
    if (!approved) return { ok: false, message: 'Not found' };
    return { ok: true, discovery: approved };
  }

  @Patch('posts/:id/hide')
  @UseGuards(AuthenticatedGuard)
  @ApiOperation({ summary: 'Hide a discovery (dev/admin action)' })
  @ApiResponse({ status: 200, description: 'Discovery hidden' })
  async hidePost(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    if (req.user?.role !== 'admin' && req.user?.role !== 'moderator') {
      throw new ForbiddenException('Insufficient permissions');
    }

    const result = await this.communityService.hideDiscovery(
      id,
      req.user?.id ?? null,
    );
    if (!result) return { ok: false, message: 'Not found' };
    return { ok: true };
  }
}
