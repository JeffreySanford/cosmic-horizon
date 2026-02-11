import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto, ReportCommentDto } from '../dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import type { AuthenticatedRequest } from '../types/http.types';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('post/:postId')
  getComments(@Param('postId') postId: string) {
    return this.commentsService.getCommentsByPost(postId);
  }

  @Post()
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  createComment(@Request() req: AuthenticatedRequest, @Body() dto: CreateCommentDto) {
    return this.commentsService.createComment(req.user.id, dto);
  }

  @Put(':id')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  updateComment(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto
  ) {
    return this.commentsService.updateComment(id, req.user.id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.commentsService.deleteComment(id, req.user.id);
  }

  @Post(':id/report')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  reportComment(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ReportCommentDto
  ) {
    return this.commentsService.reportComment(id, req.user.id, dto);
  }

  @Patch(':id/hide')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  hideComment(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.commentsService.hideComment(id, req.user.id);
  }

  @Patch(':id/unhide')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  unhideComment(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.commentsService.unhideComment(id, req.user.id);
  }

  @Get('reports/all')
  @UseGuards(AuthenticatedGuard)
  getAllReports(@Request() req: AuthenticatedRequest) {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      throw new ForbiddenException('Admin access required');
    }
    return this.commentsService.getAllReports();
  }

  @Patch('reports/:id/resolve')
  @UseGuards(AuthenticatedGuard)
  resolveReport(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { status: 'reviewed' | 'dismissed' }
  ) {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      throw new ForbiddenException('Admin access required');
    }
    return this.commentsService.resolveReport(id, req.user.id, body.status);
  }
}
