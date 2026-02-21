import { Component, inject } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { MessagingService } from '../../../services/messaging.service';
import { PerformanceDataService } from '../../../services/performance-data.service';
import { scan, startWith, map } from 'rxjs/operators';

interface OperationTile {
  title: string;
  route: string;
  colorClass: string;
  badge$?: Observable<number>;
  subtitle$?: Observable<string>;
  status$?: Observable<string>;
  extraChips$?: Observable<{ text: string; color?: string }[]>;
}

@Component({
  selector: 'app-operations-home',
  templateUrl: './operations-home.component.html',
  styleUrls: ['./operations-home.component.scss'],
  standalone: false,
})
export class OperationsHomeComponent {
  tiles: OperationTile[];

  private messaging = inject(MessagingService);
  private perf = inject(PerformanceDataService);

  constructor() {
    const alertCount$ = this.messaging.notifications$.pipe(
      scan((acc) => acc + 1, 0),
      startWith(0),
    );

    const brokerStatus$ = this.messaging.stats$.pipe(
      map((s) => {
        if (!s) return 'unknown';
        const allConnected =
          s.infra.rabbitmq.connected && s.infra.kafka.connected;
        return allConnected ? 'healthy' : 'degraded';
      }),
      startWith('unknown'),
    );

    const lastRefresh$ = this.messaging.stats$.pipe(
      map((s) => (s ? s.at : '')),
      startWith(''),
    );

    const msgsPerSec$ = this.messaging.stats$.pipe(
      map((s) => (s ? s.packetsPerSecond.toString() : '0')),
      startWith('0'),
    );

    const packets$ = this.messaging.stats$.pipe(
      map((s) => (s ? s.packetsPerSecond.toString() : '0')),
      startWith('0'),
    );

    const cpuAvg$ = this.perf.progressSeries$.pipe(
      map((arr) => {
        if (!arr || arr.length === 0) return 0;
        const last = arr[arr.length - 1].series[0]?.value;
        return last ?? 0;
      }),
      startWith(0),
    );

    const gpuAvg$ = this.perf.gpuProgressSeries$.pipe(
      map((arr) => {
        if (!arr || arr.length === 0) return 0;
        const last = arr[arr.length - 1].series[0]?.value;
        return last ?? 0;
      }),
      startWith(0),
    );

    const nodeChips$ = combineLatest([cpuAvg$, gpuAvg$]).pipe(
      map(([c, g]) => [
        { text: `CPU ${c}` },
        { text: `GPU ${g}` },
      ]),
    );

    const brokerChips$ = packets$.pipe(
      map((v) => [{ text: `${v} p/s` }]),
    );

    this.tiles = [
      {
        title: 'Broker Comparison',
        route: 'broker-comparison',
        colorClass: 'tile-primary',
        status$: brokerStatus$,
        subtitle$: lastRefresh$.pipe(map(ts => ts ? `refreshed ${ts}` : '')),
        extraChips$: brokerChips$,
      },
      {
        title: 'Job Dashboard',
        route: 'job-dashboard',
        colorClass: 'tile-accent',
        badge$: alertCount$,
        subtitle$: msgsPerSec$.pipe(map(v => `${v} msg/s`)),
      },
      {
        title: 'Node Performance',
        route: 'node-performance',
        colorClass: 'tile-warn',
        extraChips$: nodeChips$,
      },
      {
        title: 'Load Tests',
        route: 'load-tests',
        colorClass: 'tile-secondary',
      },
    ];
  }
}
