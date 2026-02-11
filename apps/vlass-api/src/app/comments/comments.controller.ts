import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from '../dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { User } from '../entities';

type RequestWithUser = {
  user: User;
};

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('post/:postId')
  getComments(@Param('postId') postId: string) {
    return this.commentsService.getCommentsByPost(postId);
  }

  @Post()
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  createComment(@Request() req: RequestWithUser, @Body() dto: CreateCommentDto) {
    return this.commentsService.createComment(req.user.id, dto);
  }

  @Put(':id')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  updateComment(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto
  ) {
    return this.commentsService.updateComment(id, req.user.id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(@Request() req: RequestWithUser, @Param('id') id: string) {
    await this.commentsService.deleteComment(id, req.user.id);
  }
}
