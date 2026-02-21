import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, isDevMode, PLATFORM_ID } from '@angular/core';
import { AppLoggerService } from '../../services/app-logger.service';

interface ViewerSsrTelemetryStore {
  transfer_state_hits: number;
  transfer_state_misses: number;
  bootstrap_hits: number;
  bootstrap_misses: number;
  updated_at: string;
}

export interface ViewerSsrTelemetrySnapshot {
  transferStateHits: number;
  transferStateMisses: number;
  transferStateHitRate: number;
  bootstrapHits: number;
  bootstrapMisses: number;
  bootstrapHitRate: number;
  updatedAt: string;
}

const STORAGE_KEY = 'cosmic.viewer.ssr.telemetry.v1';

@Injectable({ providedIn: 'root' })
export class ViewerSsrTelemetryService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly logger = inject(AppLoggerService);
  private localStore: ViewerSsrTelemetryStore = this.createEmptyStore();

  recordTransferStateHit(): void {
    this.updateStore((store) => {
      store.transfer_state_hits += 1;
    });
  }

  recordTransferStateMiss(): void {
    this.updateStore((store) => {
      store.transfer_state_misses += 1;
    });
  }

  recordBootstrapHit(): void {
    this.updateStore((store) => {
      store.bootstrap_hits += 1;
    });
  }

  recordBootstrapMiss(): void {
    this.updateStore((store) => {
      store.bootstrap_misses += 1;
    });
  }

  snapshot(): ViewerSsrTelemetrySnapshot {
    const store = this.readStore();
    const transferSamples =
      store.transfer_state_hits + store.transfer_state_misses;
    const bootstrapSamples = store.bootstrap_hits + store.bootstrap_misses;

    return {
      transferStateHits: store.transfer_state_hits,
      transferStateMisses: store.transfer_state_misses,
      transferStateHitRate:
        transferSamples > 0
          ? Number((store.transfer_state_hits / transferSamples).toFixed(4))
          : 0,
      bootstrapHits: store.bootstrap_hits,
      bootstrapMisses: store.bootstrap_misses,
      bootstrapHitRate:
        bootstrapSamples > 0
          ? Number((store.bootstrap_hits / bootstrapSamples).toFixed(4))
          : 0,
      updatedAt: store.updated_at,
    };
  }

  logSnapshot(event: string): void {
    if (!isPlatformBrowser(this.platformId) || !isDevMode()) {
      return;
    }

    const snap = this.snapshot();
    this.logger.info('viewer', event, {
      transfer_state_hits: snap.transferStateHits,
      transfer_state_misses: snap.transferStateMisses,
      transfer_state_hit_rate: snap.transferStateHitRate,
      bootstrap_hits: snap.bootstrapHits,
      bootstrap_misses: snap.bootstrapMisses,
      bootstrap_hit_rate: snap.bootstrapHitRate,
    });
  }

  private updateStore(mutator: (store: ViewerSsrTelemetryStore) => void): void {
    const next = this.readStore();
    mutator(next);
    next.updated_at = new Date().toISOString();
    this.writeStore(next);
  }

  private readStore(): ViewerSsrTelemetryStore {
    if (!isPlatformBrowser(this.platformId)) {
      return { ...this.localStore };
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return this.createEmptyStore();
      }

      const parsed = JSON.parse(raw) as Partial<ViewerSsrTelemetryStore>;
      return {
        transfer_state_hits: Number(parsed.transfer_state_hits ?? 0),
        transfer_state_misses: Number(parsed.transfer_state_misses ?? 0),
        bootstrap_hits: Number(parsed.bootstrap_hits ?? 0),
        bootstrap_misses: Number(parsed.bootstrap_misses ?? 0),
        updated_at:
          typeof parsed.updated_at === 'string'
            ? parsed.updated_at
            : new Date(0).toISOString(),
      };
    } catch {
      return this.createEmptyStore();
    }
  }

  private writeStore(store: ViewerSsrTelemetryStore): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.localStore = { ...store };
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      this.localStore = { ...store };
    }
  }

  private createEmptyStore(): ViewerSsrTelemetryStore {
    return {
      transfer_state_hits: 0,
      transfer_state_misses: 0,
      bootstrap_hits: 0,
      bootstrap_misses: 0,
      updated_at: new Date(0).toISOString(),
    };
  }
}
