import { Injectable, Logger } from '@nestjs/common';
import { DiscoveryEvent } from './discovery.entity';
import { CreateDiscoveryDto } from './dto/create-discovery.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);
  private readonly inMemoryFeed: DiscoveryEvent[] = [];

  constructor() {
    // seed a couple of lightweight prototype discoveries
    this.inMemoryFeed.push(
      {
        id: uuidv4(),
        title: 'Welcome to Community Discoveries (prototype)',
        body: 'This is a lightweight prototype: in-memory store, no persistence yet.',
        author: 'system',
        tags: ['prototype', 'welcome'],
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        title: 'Try posting a discovery',
        body: "POST /api/community/posts will create a new discovery — visible in the feed and by toast.",
        author: 'system',
        tags: ['howto'],
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
    );
  }

  async getFeed(limit = 25): Promise<DiscoveryEvent[]> {
    const sorted = [...this.inMemoryFeed].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return sorted.slice(0, limit);
  }

  async createDiscovery(dto: CreateDiscoveryDto): Promise<DiscoveryEvent> {
    const item: DiscoveryEvent = {
      id: uuidv4(),
      title: dto.title,
      body: dto.body,
      author: dto.author ?? 'anonymous',
      tags: dto.tags ?? [],
      createdAt: new Date().toISOString(),
    };

    this.inMemoryFeed.unshift(item);
    this.logger.log(`Created discovery: ${item.id} (${item.title})`);
    return item;
  }
}
