import { IsObject } from 'class-validator';

export interface ViewerLabelPayload {
  name: string;
  ra: number;
  dec: number;
  created_at?: string;
}

export interface ViewerStatePayload {
  ra: number;
  dec: number;
  fov: number;
  survey: string;
  labels?: ViewerLabelPayload[];
}

export class CreateViewerStateDto {
  @IsObject()
  state!: ViewerStatePayload;
}
