import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  content!: string;

  @IsUUID()
  user_id!: string;
}
