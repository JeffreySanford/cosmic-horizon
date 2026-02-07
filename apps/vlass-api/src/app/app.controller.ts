import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { AppService } from './app.service';
import { CreateUserDto, UpdateUserDto, CreatePostDto, UpdatePostDto } from './dto';

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
  @Get('api/users')
  getAllUsers() {
    return this.appService.getAllUsers();
  }

  @Post('api/users')
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.appService.createUser(createUserDto);
  }

  @Get('api/users/:id')
  getUserById(@Param('id') id: string) {
    return this.appService.getUserById(id);
  }

  @Put('api/users/:id')
  updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.appService.updateUser(id, updateUserDto);
  }

  @Delete('api/users/:id')
  deleteUser(@Param('id') id: string) {
    return this.appService.deleteUser(id);
  }

  // Posts endpoints
  @Get('api/posts')
  getAllPosts() {
    return this.appService.getAllPosts();
  }

  @Get('api/posts/published')
  getPublishedPosts() {
    return this.appService.getPublishedPosts();
  }

  @Post('api/posts')
  createPost(@Body() createPostDto: CreatePostDto) {
    return this.appService.createPost(createPostDto);
  }

  @Get('api/posts/:id')
  getPostById(@Param('id') id: string) {
    return this.appService.getPostById(id);
  }

  @Put('api/posts/:id')
  updatePost(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto) {
    return this.appService.updatePost(id, updatePostDto);
  }

  @Post('api/posts/:id/publish')
  publishPost(@Param('id') id: string) {
    return this.appService.publishPost(id);
  }

  @Post('api/posts/:id/unpublish')
  unpublishPost(@Param('id') id: string) {
    return this.appService.unpublishPost(id);
  }

  @Delete('api/posts/:id')
  deletePost(@Param('id') id: string) {
    return this.appService.deletePost(id);
  }

  @Get('api/users/:userId/posts')
  getPostsByUser(@Param('userId') userId: string) {
    return this.appService.getPostsByUser(userId);
  }
}
