import { IsOptional, IsString, IsEmail, IsInt } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsInt()
  github_id?: number;

  @IsOptional()
  @IsString()
  full_name?: string;
}
