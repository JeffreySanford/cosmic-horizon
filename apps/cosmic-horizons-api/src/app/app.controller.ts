import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppService } from './app.service';
import {
  CreateUserDto,
  UpdateUserDto,
  CreatePostDto,
  UpdatePostDto,
} from './dto';
import { AuthenticatedGuard } from './auth/guards/authenticated.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import type { AuthenticatedRequest } from './types/http.types';

type InternalDocCatalogEntry = {
  id: string;
  label: string;
  section: string;
  sourcePath: string;
};

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

  @Get('internal-docs/catalog')
  async getDocumentationCatalog() {
    const catalog = await this.loadDocumentationCatalog();
    return {
      count: catalog.length,
      docs: catalog,
    };
  }

  @Get('internal-docs/content/:docId')
  async getDocumentationContent(@Param('docId') docId: string) {
    const catalog = await this.loadDocumentationCatalog();
    const match = catalog.find((entry) => entry.id === docId);
    if (!match) {
      throw new BadRequestException(`Unsupported doc id: ${docId}`);
    }

    const workspaceRoot = this.findWorkspaceRoot();
    const absolutePath = resolve(workspaceRoot, match.sourcePath);
    try {
      const content = await readFile(absolutePath, 'utf8');
      return {
        docId,
        sourcePath: match.sourcePath,
        content,
      };
    } catch {
      throw new NotFoundException(
        `Documentation file is unavailable: ${match.sourcePath}`,
      );
    }
  }

  private async loadDocumentationCatalog(): Promise<InternalDocCatalogEntry[]> {
    const workspaceRoot = this.findWorkspaceRoot();
    const catalogPath = resolve(
      workspaceRoot,
      'documentation/index/DOCS-VIEW-CATALOG.json',
    );

    try {
      const raw = await readFile(catalogPath, 'utf8');
      const parsed = JSON.parse(raw) as InternalDocCatalogEntry[];
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid docs catalog format');
      }
      return parsed.filter(
        (entry) =>
          typeof entry.id === 'string' &&
          typeof entry.label === 'string' &&
          typeof entry.section === 'string' &&
          typeof entry.sourcePath === 'string',
      );
    } catch {
      // Fallback protects local dev if catalog build has not run yet.
      return [
        {
          id: 'documentation--architecture--architecture',
          label: 'Architecture',
          section: 'Architecture',
          sourcePath: 'documentation/architecture/ARCHITECTURE.md',
        },
        {
          id: 'documentation--planning--roadmap--roadmap',
          label: 'Roadmap',
          section: 'Planning',
          sourcePath: 'documentation/planning/roadmap/ROADMAP.md',
        },
      ];
    }
  }

  private findWorkspaceRoot(): string {
    let current = process.cwd();
    while (true) {
      if (existsSync(resolve(current, 'nx.json'))) {
        return current;
      }
      const parent = resolve(current, '..');
      if (parent === current) {
        return process.cwd();
      }
      current = parent;
    }
  }

  // Users endpoints
  @Get('users')
  getAllUsers() {
    return this.appService.getAllUsers();
  }

  @Post('users')
  @UseGuards(RateLimitGuard)
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.appService.createUser(createUserDto);
  }

  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    return this.appService.getUserById(id);
  }

  @Put('users/:id')
  @UseGuards(RateLimitGuard)
  updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.appService.updateUser(id, updateUserDto);
  }

  @Delete('users/:id')
  @UseGuards(RateLimitGuard)
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
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  createPost(
    @Request() req: AuthenticatedRequest,
    @Body() createPostDto: CreatePostDto,
  ) {
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
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  updatePost(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.appService.updatePost(id, req.user.id, updatePostDto);
  }

  @Post('posts/:id/publish')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  publishPost(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.appService.publishPost(id, req.user.id);
  }

  @Post('posts/:id/unpublish')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  unpublishPost(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.appService.unpublishPost(id, req.user.id);
  }

  @Delete('posts/:id')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  deletePost(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.appService.deletePost(id, req.user.id);
  }

  @Post('posts/:id/hide')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  hidePost(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.appService.hidePost(id, req.user.id);
  }

  @Post('posts/:id/unhide')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  unhidePost(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.appService.unhidePost(id, req.user.id);
  }

  @Post('posts/:id/lock')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  lockPost(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.appService.lockPost(id, req.user.id);
  }

  @Post('posts/:id/unlock')
  @UseGuards(AuthenticatedGuard, RateLimitGuard)
  unlockPost(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.appService.unlockPost(id, req.user.id);
  }

  @Get('users/:userId/posts')
  getPostsByUser(@Param('userId') userId: string) {
    return this.appService.getPostsByUser(userId);
  }
}
