export interface DiscoveryEvent {
  id: string;
  title: string;
  body?: string;
  author?: string;
  tags?: string[];
  createdAt: string; // ISO timestamp
}
