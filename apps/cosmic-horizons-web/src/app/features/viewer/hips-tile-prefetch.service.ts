import { inject, Injectable, isDevMode, OnDestroy } from '@angular/core';
import { AppLoggerService } from '../../services/app-logger.service';

interface TileCacheEntry {
  body: ArrayBuffer;
  contentType: string;
  status: number;
  statusText: string;
  createdAt: number;
  lastAccessAt: number;
}

interface ParsedTileUrl {
  prefix: string;
  order: number;
  pixel: number;
  extension: string;
}

@Injectable({
  providedIn: 'root',
})
export class HipsTilePrefetchService implements OnDestroy {
  private readonly cache = new Map<string, TileCacheEntry>();
  private readonly prefetchSeenAt = new Map<string, number>();
  private readonly inFlight = new Set<string>();
  private readonly ttlMs = 90_000;
  private readonly maxEntries = 384;
  private readonly maxPrefetchPerTile = 24;
  private readonly prefetchCooldownMs = 1_000;
  private readonly prefetchDebounceMs = 200;

  private refCount = 0;
  private originalFetch: typeof globalThis.fetch | null = null;
  private prefetchTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPrefetchSeeds = new Set<string>();
  private readonly appLogger = inject(AppLoggerService);

  activate(): void {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
      return;
    }

    this.refCount += 1;
    if (this.originalFetch) {
      return;
    }

    this.originalFetch = window.fetch.bind(window);
    window.fetch = this.patchedFetch.bind(this);
  }

  deactivate(): void {
    if (this.refCount > 0) {
      this.refCount -= 1;
    }

    if (this.refCount > 0) {
      return;
    }

    if (typeof window !== 'undefined' && this.originalFetch) {
      window.fetch = this.originalFetch;
    }
    this.originalFetch = null;
    this.pendingPrefetchSeeds.clear();

    if (this.prefetchTimer) {
      clearTimeout(this.prefetchTimer);
      this.prefetchTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.deactivate();
  }

  private patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const originalFetch = this.originalFetch;
    if (!originalFetch) {
      return fetch(input, init);
    }

    const url = this.extractUrl(input);
    const method = this.extractMethod(input, init);
    const cacheableTile = method === 'GET' && this.isCacheableTileUrl(url);

    if (!cacheableTile) {
      return originalFetch(input, init);
    }

    const cached = this.getFreshCacheEntry(url);
    if (cached) {
      return Promise.resolve(this.createResponseFromCache(cached));
    }

    return originalFetch(input, init).then(async (response) => {
      await this.storeResponseInCache(url, response);
      this.schedulePrefetch(url);
      return response;
    });
  }

  private extractUrl(input: RequestInfo | URL): string {
    if (typeof input === 'string') {
      return input;
    }

    if (input instanceof URL) {
      return input.toString();
    }

    return input.url;
  }

  private extractMethod(input: RequestInfo | URL, init?: RequestInit): string {
    if (typeof init?.method === 'string') {
      return init.method.toUpperCase();
    }

    if (
      typeof input !== 'string' &&
      !(input instanceof URL) &&
      typeof input.method === 'string'
    ) {
      return input.method.toUpperCase();
    }

    return 'GET';
  }

  private isCacheableTileUrl(rawUrl: string): boolean {
    try {
      const url = new URL(rawUrl);
      if (!/^https?:$/i.test(url.protocol)) {
        return false;
      }

      if (
        !/\/Norder\d+\/Dir\d+\/Npix\d+\.(?:jpg|jpeg|png|webp|fits)$/i.test(
          url.pathname,
        )
      ) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private getFreshCacheEntry(url: string): TileCacheEntry | null {
    const entry = this.cache.get(url);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.createdAt > this.ttlMs) {
      this.cache.delete(url);
      return null;
    }

    entry.lastAccessAt = now;
    this.touchEntry(url, entry);
    return entry;
  }

  private createResponseFromCache(entry: TileCacheEntry): Response {
    const headers = new Headers({
      'Content-Type': entry.contentType,
      'X-Cosmic-Tile-Cache': 'HIT',
    });

    return new Response(entry.body.slice(0), {
      status: entry.status,
      statusText: entry.statusText,
      headers,
    });
  }

  private async storeResponseInCache(
    url: string,
    response: Response,
  ): Promise<void> {
    if (!response.ok || response.type === 'opaque') {
      return;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (
      !/(image\/|application\/fits|application\/octet-stream)/i.test(
        contentType,
      )
    ) {
      return;
    }

    try {
      const clone = response.clone();
      const body = await clone.arrayBuffer();
      if (body.byteLength === 0) {
        return;
      }

      const now = Date.now();
      const entry: TileCacheEntry = {
        body,
        contentType,
        status: response.status,
        statusText: response.statusText,
        createdAt: now,
        lastAccessAt: now,
      };

      this.cache.set(url, entry);
      this.touchEntry(url, entry);
      this.evictExpiredAndOverflow();
    } catch {
      // Ignore non-bufferable responses.
    }
  }

  private touchEntry(url: string, entry: TileCacheEntry): void {
    this.cache.delete(url);
    this.cache.set(url, entry);
  }

  private evictExpiredAndOverflow(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > this.ttlMs) {
        this.cache.delete(key);
      }
    }

    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.cache.delete(oldestKey);
    }
  }

  private schedulePrefetch(seedUrl: string): void {
    const now = Date.now();
    const last = this.prefetchSeenAt.get(seedUrl) ?? 0;
    if (now - last < this.prefetchCooldownMs) {
      return;
    }
    this.prefetchSeenAt.set(seedUrl, now);
    this.pendingPrefetchSeeds.add(seedUrl);

    if (this.prefetchTimer) {
      return;
    }

    this.prefetchTimer = setTimeout(() => {
      this.prefetchTimer = null;
      const seeds = [...this.pendingPrefetchSeeds];
      this.pendingPrefetchSeeds.clear();

      for (const seed of seeds) {
        void this.prefetchAround(seed);
      }
    }, this.prefetchDebounceMs);
  }

  private async prefetchAround(seedUrl: string): Promise<void> {
    const originalFetch = this.originalFetch;
    if (!originalFetch) {
      return;
    }

    const neighbors = this.neighborTileUrls(seedUrl).slice(
      0,
      this.maxPrefetchPerTile,
    );
    for (const url of neighbors) {
      if (this.inFlight.has(url) || this.getFreshCacheEntry(url)) {
        continue;
      }

      this.inFlight.add(url);
      try {
        const response = await originalFetch(url, {
          cache: 'force-cache',
          mode: 'cors',
          credentials: 'omit',
        });
        await this.storeResponseInCache(url, response);
      } catch {
        // Best effort prefetch only.
      } finally {
        this.inFlight.delete(url);
      }
    }
  }

  private neighborTileUrls(seedUrl: string): string[] {
    const parsed = this.parseTileUrl(seedUrl);
    if (!parsed) {
      return [];
    }

    const candidates = new Set<string>();

    if (parsed.order < 15) {
      const childBase = parsed.pixel * 4;
      for (let i = 0; i < 4; i += 1) {
        candidates.add(
          this.buildTileUrl(
            parsed.prefix,
            parsed.order + 1,
            childBase + i,
            parsed.extension,
          ),
        );
      }
    }

    const sameOrderOffsets = [
      -4, -3, -2, -1, 1, 2, 3, 4, -16, 16, -32, 32, -64, 64,
    ];
    for (const offset of sameOrderOffsets) {
      const pixel = parsed.pixel + offset;
      if (pixel >= 0) {
        candidates.add(
          this.buildTileUrl(
            parsed.prefix,
            parsed.order,
            pixel,
            parsed.extension,
          ),
        );
      }
    }

    if (parsed.order < 15) {
      const childBase = parsed.pixel * 4;
      for (let i = 0; i < 4; i += 1) {
        const childPixel = childBase + i;
        if (parsed.order < 14) {
          const grandChildBase = childPixel * 4;
          for (let j = 0; j < 4; j += 1) {
            candidates.add(
              this.buildTileUrl(
                parsed.prefix,
                parsed.order + 2,
                grandChildBase + j,
                parsed.extension,
              ),
            );
          }
        }
      }
    }

    if (parsed.order > 0) {
      const parentPixel = Math.floor(parsed.pixel / 4);
      candidates.add(
        this.buildTileUrl(
          parsed.prefix,
          parsed.order - 1,
          parentPixel,
          parsed.extension,
        ),
      );
    }

    candidates.delete(seedUrl);
    return [...candidates];
  }

  private parseTileUrl(rawUrl: string): ParsedTileUrl | null {
    const match = rawUrl.match(
      /^(.*)\/Norder(\d+)\/Dir\d+\/Npix(\d+)\.(jpg|jpeg|png|webp|fits)$/i,
    );
    if (!match) {
      return null;
    }

    return {
      prefix: match[1],
      order: Number(match[2]),
      pixel: Number(match[3]),
      extension: match[4].toLowerCase(),
    };
  }

  private buildTileUrl(
    prefix: string,
    order: number,
    pixel: number,
    extension: string,
  ): string {
    const dir = Math.floor(pixel / 10_000) * 10_000;
    return `${prefix}/Norder${order}/Dir${dir}/Npix${pixel}.${extension}`;
  }

  debugSnapshot(): { cacheSize: number; inFlight: number } {
    return { cacheSize: this.cache.size, inFlight: this.inFlight.size };
  }

  logDebugState(): void {
    if (!isDevMode()) {
      return;
    }

    const snapshot = this.debugSnapshot();
    this.appLogger.debug('viewer', 'tile_cache_snapshot', {
      cacheSize: snapshot.cacheSize,
      inFlight: snapshot.inFlight,
    });
  }
}
