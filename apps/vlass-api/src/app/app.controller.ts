import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { AppService } from './app.service';
import { CreateUserDto, UpdateUserDto, CreatePostDto, UpdatePostDto } from './dto';
import { AuthenticatedGuard } from './auth/guards/authenticated.guard';
import { User } from './entities';

type RequestWithUser = ExpressRequest & { user: User };

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Get('health')
  getHealth() {
    return this.appService.getHealthStatus();
  }

  // Users endpoints
  @Get('users')
  getAllUsers() {
    return this.appService.getAllUsers();
  }

  @Post('users')
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.appService.createUser(createUserDto);
  }

  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    return this.appService.getUserById(id);
  }

  @Put('users/:id')
  updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.appService.updateUser(id, updateUserDto);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.appService.deleteUser(id);
  }

  // Posts endpoints
  @Get('posts')
  getAllPosts() {
    return this.appService.getAllPosts();
  }

  @Get('posts/published')
  getPublishedPosts() {
    return this.appService.getPublishedPosts();
  }

  @Post('posts')
  @UseGuards(AuthenticatedGuard)
  createPost(@Request() req: RequestWithUser, @Body() createPostDto: CreatePostDto) {
    return this.appService.createPost({
      ...createPostDto,
      user_id: req.user.id,
    });
  }

  @Get('posts/:id')
  getPostById(@Param('id') id: string) {
    return this.appService.getPostById(id);
  }

  @Put('posts/:id')
  @UseGuards(AuthenticatedGuard)
  updatePost(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto) {
    return this.appService.updatePost(id, updatePostDto);
  }

  @Post('posts/:id/publish')
  @UseGuards(AuthenticatedGuard)
  publishPost(@Param('id') id: string) {
    return this.appService.publishPost(id);
  }

  @Post('posts/:id/unpublish')
  @UseGuards(AuthenticatedGuard)
  unpublishPost(@Param('id') id: string) {
    return this.appService.unpublishPost(id);
  }

  @Delete('posts/:id')
  @UseGuards(AuthenticatedGuard)
  deletePost(@Param('id') id: string) {
    return this.appService.deletePost(id);
  }

  @Get('users/:userId/posts')
  getPostsByUser(@Param('userId') userId: string) {
    return this.appService.getPostsByUser(userId);
  }
}
