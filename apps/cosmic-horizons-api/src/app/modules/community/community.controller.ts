import { Body, Controller, Get, Post, HttpCode, HttpStatus, Logger } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Create a discovery (prototype, no moderation yet)' })
  @ApiResponse({ status: 201, description: 'Discovery created' })
  async createPost(@Body() payload: CreateDiscoveryDto) {
    const created = await this.communityService.createDiscovery(payload);
    // TODO: publish an event via EventsModule (prototype uses in-memory feed)
    return created;
  }
}
