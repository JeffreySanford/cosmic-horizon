import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BrokerComparisonDTO, BrokerHistoryDTO, BenchmarkResult } from '../models/broker-metrics.model';

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
  private readonly http = inject(HttpClient);

  /**
   * Get current broker metrics
   * GET /api/internal/brokers/stats
   */
  getCurrentMetrics(): Observable<BrokerComparisonDTO> {
    return this.http.get<BrokerComparisonDTO>(`${this.API_BASE}/stats`);
  }

  /**
   * Get historical metrics for charting
   * GET /api/internal/brokers/history?hours=24
   */
  getHistoricalMetrics(hours = 24): Observable<BrokerHistoryDTO> {
    const params = new HttpParams().set('hours', hours.toString());
    return this.http.get<BrokerHistoryDTO>(`${this.API_BASE}/history`, { params });
  }

  /**
   * Run benchmark test
   * POST /api/internal/brokers/benchmark
   */
  runBenchmark(): Observable<BenchmarkResult> {
    return this.http.post<BenchmarkResult>(`${this.API_BASE}/benchmark`, {});
  }

  /**
   * Get broker health status
   * GET /api/internal/brokers/health
   */
  getHealth(): Observable<Record<string, string>> {
    return this.http.get<Record<string, string>>(`${this.API_BASE}/health`);
  }
}
