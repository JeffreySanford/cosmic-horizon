export interface ViewerStatePayload {
  ra: number;
  dec: number;
  fov: number;
  survey: string;
}

export class CreateViewerStateDto {
  state!: ViewerStatePayload;
}
