export interface ViewerCutoutRequest {
  ra: number;
  dec: number;
  fov: number;
  survey: string;
  label?: string;
  detail?: 'standard' | 'high' | 'max';
}
