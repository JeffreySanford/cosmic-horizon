import { ViewerStatePayload } from './create-viewer-state.dto';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateViewerSnapshotDto {
  @IsString()
  image_data_url!: string;

  @IsOptional()
  @IsString()
  short_id?: string;

  @IsOptional()
  @IsObject()
  state?: ViewerStatePayload;
}
