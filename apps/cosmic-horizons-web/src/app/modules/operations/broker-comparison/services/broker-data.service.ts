import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  BrokerComparisonDTO,
  BrokerHistoryDTO,
  BenchmarkResult,
  SystemMetrics,
} from '../models/broker-metrics.model';

export type BenchmarkBroker = 'rabbitmq' | 'kafka' | 'pulsar';

export interface BenchmarkOptions {
  brokers?: BenchmarkBroker[];
  payloadKb?: number;
  inflight?: number;
  trials?: number;
  seed?: number;
  measuredOnly?: boolean;
}

/**
 * BrokerDataService
 *
 * Provides HTTP access to broker metrics API endpoints.
 * Interfaces with backend `/api/internal/brokers/*` endpoints.
 */
@Injectable({
  providedIn: 'root',
})
export class BrokerDataService {
  private readonly API_BASE = '/api/internal/brokers';
  private readonly WARM_START_CACHE_KEY = 'broker-comparison:last-metrics';
  private readonly WARM_START_MAX_AGE_MS = 5 * 60 * 1000;
  private readonly http = inject(HttpClient);
  private inMemoryWarmStart: {
    cachedAt: number;
    data: BrokerComparisonDTO;
  } | null = null;

  /**
   * Get current broker metrics
   * GET /api/internal/brokers/stats
   */
  getCurrentMetrics(forceRefresh = false): Observable<BrokerComparisonDTO> {
    let params = new HttpParams();
    if (forceRefresh) {
      params = params.set('forceRefresh', 'true');
    }
    return this.http
      .get<BrokerComparisonDTO>(`${this.API_BASE}/stats`, { params })
      .pipe(tap((data) => this.cacheWarmStartSnapshot(data)));
  }

  /**
   * Returns a recent metrics snapshot for instant first paint while live data loads.
   */
  getWarmStartMetrics(
    maxAgeMs = this.WARM_START_MAX_AGE_MS,
  ): BrokerComparisonDTO | null {
    const now = Date.now();
    const inMemory = this.inMemoryWarmStart;
    if (inMemory && now - inMemory.cachedAt <= maxAgeMs) {
      return inMemory.data;
    }

    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    const raw = window.localStorage.getItem(this.WARM_START_CACHE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as {
        cachedAt: number;
        data: BrokerComparisonDTO;
      };
      if (
        !parsed ||
        typeof parsed.cachedAt !== 'number' ||
        !parsed.data ||
        now - parsed.cachedAt > maxAgeMs
      ) {
        return null;
      }

      const hydrated = this.hydrateBrokerComparisonDto(parsed.data);
      this.inMemoryWarmStart = { cachedAt: parsed.cachedAt, data: hydrated };
      return hydrated;
    } catch {
      return null;
    }
  }

  /**
   * Get historical metrics for charting
   * GET /api/internal/brokers/history?hours=24
   */
  getHistoricalMetrics(hours = 24): Observable<BrokerHistoryDTO> {
    const params = new HttpParams().set('hours', hours.toString());
    return this.http.get<BrokerHistoryDTO>(`${this.API_BASE}/history`, {
      params,
    });
  }

  /**
   * Run benchmark test
   * POST /api/internal/brokers/benchmark
   */
  runBenchmark(
    stressTest = false,
    messageCount?: number,
    options?: BenchmarkOptions,
  ): Observable<BenchmarkResult> {
    let params = new HttpParams();
    if (stressTest) {
      params = params.set('stressTest', 'true');
    }
    if (messageCount) {
      params = params.set('messageCount', messageCount.toString());
    }
    if (options?.brokers && options.brokers.length > 0) {
      params = params.set('brokers', options.brokers.join(','));
    }
    if (options?.payloadKb) {
      params = params.set('payloadKb', options.payloadKb.toString());
    }
    if (options?.inflight) {
      params = params.set('inflight', options.inflight.toString());
    }
    if (options?.trials) {
      params = params.set('trials', options.trials.toString());
    }
    if (options?.seed) {
      params = params.set('seed', options.seed.toString());
    }
    if (options?.measuredOnly !== undefined) {
      params = params.set(
        'measuredOnly',
        options.measuredOnly ? 'true' : 'false',
      );
    }
    return this.http.post<BenchmarkResult>(
      `${this.API_BASE}/benchmark`,
      {},
      { params },
    );
  }

  /**
   * Get system metrics (CPU, Memory, Disk)
   * GET /api/internal/brokers/system-metrics
   */
  getSystemMetrics(): Observable<SystemMetrics> {
    return this.http.get<SystemMetrics>(`${this.API_BASE}/system-metrics`);
  }

  private cacheWarmStartSnapshot(data: BrokerComparisonDTO): void {
    const hydrated = this.hydrateBrokerComparisonDto(data);
    const snapshot = {
      cachedAt: Date.now(),
      data: hydrated,
    };

    this.inMemoryWarmStart = snapshot;

    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      window.localStorage.setItem(
        this.WARM_START_CACHE_KEY,
        JSON.stringify(snapshot),
      );
    } catch {
      // Ignore storage failures (private mode, quota exceeded, etc.).
    }
  }

  private hydrateBrokerComparisonDto(
    data: BrokerComparisonDTO,
  ): BrokerComparisonDTO {
    const normalizedTimestamp = data.timestamp
      ? new Date(data.timestamp)
      : new Date();
    return {
      ...data,
      timestamp: normalizedTimestamp,
    };
  }
}
