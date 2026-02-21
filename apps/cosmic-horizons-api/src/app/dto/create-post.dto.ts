import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;
}
