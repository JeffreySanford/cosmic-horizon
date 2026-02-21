import { IsEmail, IsString, IsOptional, IsUrl, IsInt } from 'class-validator';

export class CreateUserDto {
  @IsString()
  username!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsInt()
  github_id?: number;

  @IsOptional()
  @IsString()
  display_name?: string;

  @IsOptional()
  @IsUrl()
  avatar_url?: string | null;
}
