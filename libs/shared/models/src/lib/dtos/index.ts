/**
 * Data Transfer Objects for API responses
 * These are separated from database entities to allow API responses
 * to differ from database schema
 */

export interface UserDTO {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostDTO {
  id: string;
  userId: string;
  title: string;
  description?: string;
  content: string;
  status: 'draft' | 'published';
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  user?: UserDTO;
}

export interface CommentDTO {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user?: UserDTO;
}

export interface SnapshotDTO {
  id: string;
  postId: string;
  imageUrl: string;
  skyCoords?: {
    ra?: number;
    dec?: number;
    fov?: number;
  };
  createdAt: Date;
}

export interface RevisionDTO {
  id: string;
  postId: string;
  userId: string;
  title: string;
  description?: string;
  content: string;
  changeSummary?: string;
  createdAt: Date;
}

export interface HealthCheckDTO {
  status: 'ok' | 'error';
  timestamp: string;
  database: 'connected' | 'disconnected' | 'error';
  environment?: string;
  message?: string;
}
