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
