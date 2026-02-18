import { IsArray, IsOptional, IsString, ArrayMaxSize, IsNotEmpty } from 'class-validator';

export class CreateDiscoveryDto {
  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];
}
