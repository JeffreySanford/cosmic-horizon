export interface ArrayElementStatus {
  id: string;
  name: string;
  siteId: string;
  status: 'operational' | 'maintenance' | 'offline' | 'calibrating';
  azimuth: number;
  elevation: number;
  temperature: number;
  windSpeed: number;
  dataRateMbps: number;
  lastUpdate: string;
}

export interface ArraySite {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  cluster: 'Alpha' | 'Bravo' | 'Charlie';
  totalDataRateGbps: number;
  activeElements: number;
}

export interface TelemetryPacket {
  sourceId: string;
  targetId: string;
  routeType: 'node_to_hub' | 'hub_to_hub';
  elementId: string;
  siteId: string;
  timestamp: string;
  metrics: {
    vibration: number;
    powerUsage: number;
    noiseFloor: number;
    rfiLevel: number;
  };
}

export interface RawDataPacket {
  elementId: string;
  chunkId: string;
  timestamp: string;
  size: number;
  payloadHash: string;
}

export interface InfraChannelSnapshot {
  connected: boolean;
  latencyMs: number | null;
}

export interface MessagingInfraSnapshot {
  rabbitmq: InfraChannelSnapshot & {
    queueDepth: number | null;
    consumers: number | null;
  };
  kafka: InfraChannelSnapshot & {
    latestOffset: number | null;
    partitions: number | null;
  };
  storage: {
    postgres: InfraChannelSnapshot;
    redis: InfraChannelSnapshot;
  };
}

export interface MessagingLiveStats {
  at: string;
  packetsPerSecond: number;
  nodeToHubPerSecond: number;
  hubToHubPerSecond: number;
  rabbitPublishedPerSecond: number;
  kafkaPublishedPerSecond: number;
  persistentWritesPerSecond: number;
  totals: {
    packets: number;
    nodeToHub: number;
    hubToHub: number;
    rabbitPublished: number;
    kafkaPublished: number;
    persistentWrites: number;
    errors: number;
  };
  infra: MessagingInfraSnapshot;
}
