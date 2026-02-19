import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';
import { PostRepository } from '../repositories/post.repository';
import { PostStatus } from '../entities/post.entity';

@Injectable()
export class ProfileService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly postRepository: PostRepository,
  ) {}

  async getProfile(username: string) {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new NotFoundException(`User @${username} not found`);
    }

    // Omit sensitive data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, github_id, email, ...safeUser } = user;

    const posts = await this.postRepository.findByUser(user.id);
    const publicPosts = posts.filter(
      (p) => p.status === PostStatus.PUBLISHED && !p.hidden_at,
    );

    return {
      user: safeUser,
      posts: publicPosts,
    };
  }

  async updateProfile(
    userId: string,
    data: { display_name?: string; bio?: string; avatar_url?: string },
  ) {
    const displayName = data.display_name?.trim();
    const bio = data.bio?.trim();
    const avatarUrl = data.avatar_url?.trim();

    if (displayName !== undefined && displayName.length === 0) {
      throw new BadRequestException('display_name cannot be empty.');
    }

    const updated = await this.userRepository.update(userId, {
      display_name: displayName,
      bio: bio && bio.length > 0 ? bio : null,
      avatar_url: avatarUrl && avatarUrl.length > 0 ? avatarUrl : null,
    });

    if (!updated) {
      throw new NotFoundException('User profile was not found.');
    }

    return updated;
  }
}
