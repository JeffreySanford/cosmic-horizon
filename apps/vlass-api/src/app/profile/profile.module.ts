import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { RepositoryModule } from '../repositories/repository.module';

@Module({
  imports: [RepositoryModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
