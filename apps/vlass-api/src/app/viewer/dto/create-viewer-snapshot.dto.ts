import { ViewerStatePayload } from './create-viewer-state.dto';

export class CreateViewerSnapshotDto {
  image_data_url!: string;
  short_id?: string;
  state?: ViewerStatePayload;
}
