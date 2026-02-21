import { IsOptional, IsString } from 'class-validator';

export class EphemerisSearchDto {
  @IsOptional()
  @IsString()
  target?: string;

  @IsOptional()
  @IsString()
  object_name?: string;

  @IsOptional()
  @IsString()
  epoch?: string;
}
