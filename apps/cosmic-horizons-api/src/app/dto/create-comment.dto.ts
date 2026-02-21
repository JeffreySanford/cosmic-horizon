import { IsString, IsOptional, IsUUID, IsNotEmpty } from 'class-validator';

export class CreateCommentDto {
  @IsUUID()
  post_id!: string;

  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}
