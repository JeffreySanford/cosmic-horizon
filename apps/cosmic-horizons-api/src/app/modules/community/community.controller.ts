import { Body, Controller, Get, Post, Patch, Param, Query, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommunityService } from './community.service';
import { CreateDiscoveryDto } from './dto/create-discovery.dto';

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

  @Post('posts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a discovery (prototype, supports dev-only moderation flags)' })
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

    const created = await this.communityService.createDiscovery(payload, opts);
    return created;
  }

  @Patch('posts/:id/approve')
  @ApiOperation({ summary: 'Approve a discovery (dev/admin action)' })
  @ApiResponse({ status: 200, description: 'Discovery approved and published' })
  async approvePost(@Param('id') id: string) {
    const approved = await this.communityService.approveDiscovery(id);
    if (!approved) return { ok: false, message: 'Not found' };
    return { ok: true, discovery: approved };
  }
}
