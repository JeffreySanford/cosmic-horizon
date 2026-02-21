import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  OnChanges,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
} from '@angular/core';
import * as d3 from 'd3';

export interface SystemMetric {
  timestamp: Date;
  cpu: number;
  memory: number;
  disk: number;
}

type SystemMetricsInput = {
  timestamp?: Date;
  cpu: number | { usage: number };
  memory: number | { percentage: number };
  disk: number | { percentage: number };
};

type ChartView =
  | 'system'
  | 'throughputImpact'
  | 'memoryImpact'
  | 'latencyImpact';

type BrokerComparisonInput = {
  timestamp?: Date | string;
  brokers?: {
    rabbitmq?: {
      messagesPerSecond?: number;
      p99LatencyMs?: number;
      memoryUsageMb?: number;
    };
    pulsar?: {
      messagesPerSecond?: number;
      p99LatencyMs?: number;
      memoryUsageMb?: number;
    };
  };
};

type BrokerMetricPoint = {
  timestamp: Date;
  rabbitmqThroughput?: number;
  pulsarThroughput?: number;
  rabbitmqLatency?: number;
  pulsarLatency?: number;
  rabbitmqMemory?: number;
  pulsarMemory?: number;
};

type ChartPoint = {
  timestamp: Date;
  [key: string]: number | Date | undefined;
};

type SeriesDefinition = {
  key: string;
  label: string;
  color: string;
};

@Component({
  selector: 'app-system-metrics-chart',
  standalone: false,
  templateUrl: './system-metrics-chart.component.html',
  styleUrls: ['./system-metrics-chart.component.scss'],
})
/* eslint-disable @typescript-eslint/no-explicit-any */
export class SystemMetricsChartComponent
  implements OnInit, OnChanges, OnDestroy
{
  private static readonly DEFAULT_SYSTEM_LEGEND = [
    { label: 'CPU Usage', color: '#ff6b6b' },
    { label: 'Memory Usage', color: '#4ecdc4' },
    { label: 'Disk I/O', color: '#45b7d1' },
  ] as const;

  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;
  @Input() maxDataPoints = 50;
  @Input() updateInterval = 2000; // 2 seconds
  @Input() averageMessageBytes = 2048;

  // Sampling interval (ms) for rendering the chart. Emits changes to parent if different.
  samplingInterval = this.updateInterval;
  // options used by the selector
  samplingOptions: number[] = [
    2000, 1000, 5000, 10000, 15000, 500, 300, 100, 20,
  ];
  // Expose sampling-interval changes so parent polling cadence can be adjusted.
  @Output() samplingIntervalChange = new EventEmitter<number>();

  messageSizePreset: '512' | '2048' | '8192' | '65536' | 'custom' = '2048';

  resetData(): void {
    // placeholder method invoked from template
  }
  customMessageBytes = 2048;

  selectedView: ChartView = 'system';
  legendItems: Array<{ label: string; color: string }> = [
    ...SystemMetricsChartComponent.DEFAULT_SYSTEM_LEGEND,
  ];

  // Internal throttling for chart updates
  private lastRenderAt = 0;

  private data: SystemMetric[] = [];
  private brokerData: BrokerMetricPoint[] = [];
  private displayData: ChartPoint[] = [];
  private activeSeries: SeriesDefinition[] = [];
  private svg: any;
  private lineLayer: any;
  private yAxisLabel: any;
  private xScale: any;
  private yScale: any;
  private xAxis: any;
  private yAxis: any;
  private tooltip: any;

  private margin = { top: 20, right: 80, bottom: 40, left: 60 };
  private width = 0;
  private height = 0;
  private readonly seriesColors = {
    cpu: '#ff6b6b',
    memory: '#4ecdc4',
    disk: '#45b7d1',
    rabbitmq: '#f08a24',
    pulsar: '#4a90e2',
    systemImpact: '#2f9e44',
  };

  ngOnInit() {
    this.syncSamplingIntervalFromInput();
    this.initializeChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['updateInterval']) {
      this.syncSamplingIntervalFromInput();
    }
  }

  ngOnDestroy() {
    this.clearData();
    if (this.tooltip) {
      this.tooltip.remove();
    }
  }

  updateData(metrics: SystemMetricsInput): void {
    // Handle both nested and flat data structures
    let cpu: number;
    let memory: number;
    let disk: number;

    if (typeof metrics.cpu === 'object' && 'usage' in metrics.cpu) {
      // Nested structure
      cpu = Number(metrics.cpu.usage);
      memory = Number((metrics.memory as { percentage: number }).percentage);
      disk = Number((metrics.disk as { percentage: number }).percentage);
    } else {
      // Flat structure
      cpu = Number(metrics.cpu as number);
      memory = Number(metrics.memory as number);
      disk = Number(metrics.disk as number);
    }

    // Skip invalid data points
    if (
      isNaN(cpu) ||
      isNaN(memory) ||
      isNaN(disk) ||
      !isFinite(cpu) ||
      !isFinite(memory) ||
      !isFinite(disk)
    ) {
      console.warn('Skipping invalid system metrics data:', metrics);
      return;
    }

    const newDataPoint: SystemMetric = {
      timestamp: metrics.timestamp || new Date(),
      cpu: cpu,
      memory: memory,
      disk: disk,
    };

    // Add the new data point and maintain max data points
    this.data.push(newDataPoint);
    if (this.data.length > this.maxDataPoints) {
      this.data.shift();
    }

    // Throttle chart render to samplingInterval
    const now = Date.now();
    if (now - this.lastRenderAt >= this.samplingInterval) {
      this.lastRenderAt = now;
      this.updateChart();
    }
  }

  updateBrokerData(metrics: BrokerComparisonInput): void {
    const timestamp = metrics.timestamp
      ? new Date(metrics.timestamp)
      : new Date();
    const rmq = metrics.brokers?.rabbitmq;
    const pulsar = metrics.brokers?.pulsar;

    const point: BrokerMetricPoint = {
      timestamp,
      rabbitmqThroughput: this.safeNumber(rmq?.messagesPerSecond),
      pulsarThroughput: this.safeNumber(pulsar?.messagesPerSecond),
      rabbitmqLatency: this.safeNumber(rmq?.p99LatencyMs),
      pulsarLatency: this.safeNumber(pulsar?.p99LatencyMs),
      rabbitmqMemory: this.safeNumber(rmq?.memoryUsageMb),
      pulsarMemory: this.safeNumber(pulsar?.memoryUsageMb),
    };

    this.brokerData.push(point);
    if (this.brokerData.length > this.maxDataPoints) {
      this.brokerData.shift();
    }

    // Throttle chart render to samplingInterval
    const now = Date.now();
    if (now - this.lastRenderAt >= this.samplingInterval) {
      this.lastRenderAt = now;
      this.updateChart();
    }
  }

  private initializeChart() {
    const element = this.chartContainer.nativeElement;
    this.width = element.clientWidth - this.margin.left - this.margin.right;
    this.height = element.clientHeight - this.margin.top - this.margin.bottom;

    this.svg = d3
      .select(element)
      .append('svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom)
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    // Add background rectangle
    this.svg
      .append('rect')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('fill', 'white')
      .attr('rx', 4)
      .attr('ry', 4);

    // Create scales
    this.xScale = d3.scaleTime().range([0, this.width]);
    this.yScale = d3.scaleLinear().range([this.height, 0]).domain([0, 100]);

    // Create axes
    this.xAxis = d3.axisBottom(this.xScale).ticks(5);
    this.yAxis = d3.axisLeft(this.yScale).ticks(5);

    // Add grid lines
    this.svg
      .append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(this.yScale)
          .ticks(5)
          .tickSize(-this.width)
          .tickFormat('' as any),
      )
      .selectAll('line')
      .attr('stroke', '#f0f0f0')
      .attr('stroke-dasharray', '2,2');

    // Add axes
    this.svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.height})`)
      .call(this.xAxis)
      .selectAll('text')
      .attr('fill', '#666');

    this.svg
      .append('g')
      .attr('class', 'y-axis')
      .call(this.yAxis)
      .selectAll('text')
      .attr('fill', '#666');

    // Add Y axis label
    this.yAxisLabel = this.svg
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - this.margin.left)
      .attr('x', 0 - this.height / 2)
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('fill', '#666')
      .style('font-size', '12px')
      .text('Usage (%)');
    this.lineLayer = this.svg.append('g').attr('class', 'line-layer');

    // Create tooltip
    this.tooltip = d3
      .select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', '#fff')
      .style('padding', '8px 12px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('opacity', 0);

    // Add mouse tracking for tooltip
    this.svg
      .append('rect')
      .attr('width', this.width)
      .attr('height', this.height)
      .style('fill', 'none')
      .style('pointer-events', 'all')
      .on('mousemove', (event: MouseEvent) => this.showTooltip(event))
      .on('mouseout', () => this.hideTooltip());
  }

  private updateChart() {
    // ensure chart initialization has run
    if (!this.xScale || !this.yScale || !this.lineLayer) {
      return;
    }

    const config = this.getDisplayConfiguration();
    this.displayData = config.data;
    this.activeSeries = config.series;
    const nextLegendItems = config.series.map((item) => ({
      label: item.label,
      color: item.color,
    }));
    if (!this.areLegendItemsEqual(this.legendItems, nextLegendItems)) {
      this.legendItems = nextLegendItems;
    }

    if (this.displayData.length === 0 || this.activeSeries.length === 0) {
      this.lineLayer.selectAll('path.dynamic-line').remove();
      return;
    }

    // Update scales
    const timeExtent = d3.extent(this.displayData, (d) => d.timestamp) as [
      Date,
      Date,
    ];
    if (!timeExtent || !timeExtent[0] || !timeExtent[1]) {
      // nothing to render yet
      return;
    }
    this.xScale.domain(timeExtent);

    const values = this.displayData.flatMap((point) =>
      this.activeSeries
        .map((series) => point[series.key])
        .filter(
          (value): value is number =>
            typeof value === 'number' && Number.isFinite(value),
        ),
    );

    if (values.length === 0) {
      this.lineLayer.selectAll('path.dynamic-line').remove();
      return;
    }

    let yMin = Math.min(...values);
    let yMax = Math.max(...values);
    if (this.selectedView === 'system') {
      yMin = 0;
      yMax = 100;
    } else if (yMin === yMax) {
      yMin -= 10;
      yMax += 10;
    } else {
      const padding = Math.max(5, (yMax - yMin) * 0.1);
      yMin -= padding;
      yMax += padding;
    }
    this.yScale.domain([yMin, yMax]);

    // Update axes
    this.svg.select('.x-axis').call(this.xAxis);
    this.svg.select('.y-axis').call(this.yAxis);
    this.svg.selectAll('.x-axis text, .y-axis text').attr('fill', '#666');
    this.svg
      .selectAll('.x-axis path, .x-axis line, .y-axis path, .y-axis line')
      .attr('stroke', '#ddd');
    this.yAxisLabel.text(config.yLabel);

    const pathSelection = this.lineLayer
      .selectAll('path.dynamic-line')
      .data(this.activeSeries, (d: any) => d.key);

    pathSelection
      .enter()
      .append('path')
      .attr('class', 'dynamic-line')
      .attr('fill', 'none')
      .attr('stroke-width', 2)
      .merge(pathSelection as any)
      .attr('stroke', (d: SeriesDefinition) => d.color)
      .attr('d', (series: SeriesDefinition) => {
        const line = d3
          .line<ChartPoint>()
          .defined((point) => typeof point[series.key] === 'number')
          .x((point) => this.xScale(point.timestamp))
          .y((point) => this.yScale(point[series.key] as number))
          .curve(d3.curveMonotoneX);
        return line(this.displayData);
      });

    pathSelection.exit().remove();
  }

  private showTooltip(event: MouseEvent) {
    if (this.displayData.length === 0 || this.activeSeries.length === 0) {
      return;
    }

    const [mouseX] = d3.pointer(event);
    const x0 = this.xScale.invert(mouseX);
    const bisect = d3.bisector((d: ChartPoint) => d.timestamp).left;
    const i = bisect(this.displayData, x0, 1);
    const d0 = this.displayData[Math.max(0, i - 1)];
    const d1 = this.displayData[Math.min(this.displayData.length - 1, i)];
    const d =
      !d1 ||
      x0.getTime() - d0.timestamp.getTime() <=
        d1.timestamp.getTime() - x0.getTime()
        ? d0
        : d1;

    const valueLines = this.activeSeries
      .map((series) => {
        const value = d[series.key];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          return `<div>${series.label}: N/A</div>`;
        }
        if (this.selectedView !== 'throughputImpact') {
          const suffix = this.selectedView === 'system' ? '%' : '% change';
          return `<div>${series.label}: ${value.toFixed(1)}${suffix}</div>`;
        }

        if (series.key !== 'rabbitmq' && series.key !== 'pulsar') {
          return `<div>${series.label}: ${value.toFixed(1)}% change</div>`;
        }

        const rawPoint = this.getNearestBrokerPoint(d.timestamp);
        const rawThroughput =
          series.key === 'rabbitmq'
            ? rawPoint?.rabbitmqThroughput
            : rawPoint?.pulsarThroughput;
        const throughputText =
          typeof rawThroughput === 'number' && Number.isFinite(rawThroughput)
            ? `${rawThroughput.toLocaleString()} msg/s`
            : 'N/A';
        const bitRateText =
          typeof rawThroughput === 'number' && Number.isFinite(rawThroughput)
            ? this.formatBitsPerSecond(this.toBitsPerSecond(rawThroughput))
            : 'N/A';

        return `<div>${series.label}: ${value.toFixed(1)}% change (${throughputText}, ${bitRateText})</div>`;
      })
      .join('');

    const throughputAssumptionNote =
      this.selectedView === 'throughputImpact'
        ? `<div style="opacity:.8">bitrate uses ${this.averageMessageBytes.toLocaleString()} bytes/message</div>`
        : '';

    this.tooltip
      .style('opacity', 1)
      .html(
        `
        <div><strong>${d.timestamp.toLocaleTimeString()}</strong></div>
        ${valueLines}
        ${throughputAssumptionNote}
      `,
      )
      .style('left', event.pageX + 10 + 'px')
      .style('top', event.pageY - 10 + 'px');
  }

  private hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style('opacity', 0);
    }
  }

  clearData(): void {
    this.data = [];
    this.brokerData = [];
    this.displayData = [];
    this.activeSeries = [];
    this.legendItems = [];
    if (this.lineLayer) {
      this.lineLayer.selectAll('path.dynamic-line').remove();
    }
    this.hideTooltip();
  }

  // Method to update data from external source
  updateMetrics(cpu: number, memory: number, disk: number) {
    // Validate that all metric values are valid numbers
    const cpuVal = Number(cpu);
    const memoryVal = Number(memory);
    const diskVal = Number(disk);

    // Skip invalid data points
    if (
      isNaN(cpuVal) ||
      isNaN(memoryVal) ||
      isNaN(diskVal) ||
      !isFinite(cpuVal) ||
      !isFinite(memoryVal) ||
      !isFinite(diskVal)
    ) {
      console.warn('Skipping invalid system metrics data:', {
        cpu,
        memory,
        disk,
      });
      return;
    }

    const newPoint: SystemMetric = {
      timestamp: new Date(),
      cpu: cpuVal,
      memory: memoryVal,
      disk: diskVal,
    };

    this.data.push(newPoint);

    if (this.data.length > this.maxDataPoints) {
      this.data.shift();
    }

    this.updateChart();
  }

  onViewChange(view: string): void {
    const parsed = (view || '').toString() as ChartView;
    if (
      parsed !== 'system' &&
      parsed !== 'throughputImpact' &&
      parsed !== 'memoryImpact' &&
      parsed !== 'latencyImpact'
    ) {
      return;
    }
    this.selectedView = parsed;
    this.updateChart();
  }

  onMessageSizePresetChange(value: string): void {
    if (value === 'custom') {
      this.messageSizePreset = 'custom';
      this.applyAverageMessageBytes(this.customMessageBytes);
      return;
    }

    if (
      value !== '512' &&
      value !== '2048' &&
      value !== '8192' &&
      value !== '65536'
    ) {
      return;
    }

    this.messageSizePreset = value;
    this.applyAverageMessageBytes(Number(value));
  }

  onCustomMessageBytesChange(value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    this.customMessageBytes = Math.round(parsed);
    if (this.messageSizePreset === 'custom') {
      this.applyAverageMessageBytes(this.customMessageBytes);
    }
  }

  private getDisplayConfiguration(): {
    data: ChartPoint[];
    series: SeriesDefinition[];
    yLabel: string;
  } {
    if (this.selectedView === 'system') {
      return {
        data: this.data.map((point) => ({
          timestamp: point.timestamp,
          cpu: point.cpu,
          memory: point.memory,
          disk: point.disk,
        })),
        series: [
          { key: 'cpu', label: 'CPU Usage', color: this.seriesColors.cpu },
          {
            key: 'memory',
            label: 'Memory Usage',
            color: this.seriesColors.memory,
          },
          { key: 'disk', label: 'Disk I/O', color: this.seriesColors.disk },
        ],
        yLabel: 'Usage (%)',
      };
    }

    if (this.selectedView === 'throughputImpact') {
      return this.buildImpactConfiguration(
        'rabbitmqThroughput',
        'pulsarThroughput',
        'cpu',
        'System CPU',
        'Impact (% change from first sample)',
      );
    }

    if (this.selectedView === 'memoryImpact') {
      return this.buildImpactConfiguration(
        'rabbitmqMemory',
        'pulsarMemory',
        'memory',
        'System Memory',
        'Impact (% change from first sample)',
      );
    }

    return this.buildImpactConfiguration(
      'rabbitmqLatency',
      'pulsarLatency',
      'cpu',
      'System CPU',
      'Impact (% change from first sample)',
    );
  }

  private buildImpactConfiguration(
    rabbitKey: keyof BrokerMetricPoint,
    pulsarKey: keyof BrokerMetricPoint,
    systemKey: keyof SystemMetric,
    systemLabel: string,
    yLabel: string,
  ): { data: ChartPoint[]; series: SeriesDefinition[]; yLabel: string } {
    const sourceRows = this.brokerData.reduce<
      Array<{
        timestamp: Date;
        rabbitmq?: number;
        pulsar?: number;
        system?: number;
      }>
    >((rows, point) => {
      const systemPoint = this.getNearestSystemPoint(point.timestamp);
      if (!systemPoint) {
        return rows;
      }
      rows.push({
        timestamp: point.timestamp,
        rabbitmq: this.safeNumber(point[rabbitKey]),
        pulsar: this.safeNumber(point[pulsarKey]),
        system: this.safeNumber(systemPoint[systemKey] as number),
      });
      return rows;
    }, []);

    const rabbitBase = this.firstPositive(
      sourceRows.map((row) => row.rabbitmq),
    );
    const pulsarBase = this.firstPositive(sourceRows.map((row) => row.pulsar));
    const systemBase = this.firstPositive(sourceRows.map((row) => row.system));

    const normalized = sourceRows.map((row) => ({
      timestamp: row.timestamp,
      rabbitmq: this.toPercentChange(row.rabbitmq, rabbitBase),
      pulsar: this.toPercentChange(row.pulsar, pulsarBase),
      system: this.toPercentChange(row.system, systemBase),
    }));

    return {
      data: normalized,
      series: [
        {
          key: 'rabbitmq',
          label: 'RabbitMQ',
          color: this.seriesColors.rabbitmq,
        },
        { key: 'pulsar', label: 'Pulsar', color: this.seriesColors.pulsar },
        {
          key: 'system',
          label: systemLabel,
          color: this.seriesColors.systemImpact,
        },
      ],
      yLabel,
    };
  }

  private getNearestSystemPoint(timestamp: Date): SystemMetric | undefined {
    if (this.data.length === 0) return undefined;

    for (let index = this.data.length - 1; index >= 0; index -= 1) {
      const point = this.data[index];
      if (point.timestamp.getTime() <= timestamp.getTime()) {
        return point;
      }
    }

    return this.data[0];
  }

  private getNearestBrokerPoint(
    timestamp: Date,
  ): BrokerMetricPoint | undefined {
    if (this.brokerData.length === 0) return undefined;

    for (let index = this.brokerData.length - 1; index >= 0; index -= 1) {
      const point = this.brokerData[index];
      if (point.timestamp.getTime() <= timestamp.getTime()) {
        return point;
      }
    }

    return this.brokerData[0];
  }

  private firstPositive(values: Array<number | undefined>): number | undefined {
    return values.find(
      (value) =>
        typeof value === 'number' && Number.isFinite(value) && value > 0,
    );
  }

  private toPercentChange(
    value: number | undefined,
    baseline: number | undefined,
  ): number | undefined {
    if (
      value === undefined ||
      baseline === undefined ||
      !Number.isFinite(value) ||
      !Number.isFinite(baseline) ||
      baseline <= 0
    ) {
      return undefined;
    }
    return ((value - baseline) / baseline) * 100;
  }

  private safeNumber(value: unknown): number | undefined {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }
    return parsed;
  }

  private toBitsPerSecond(messagesPerSecond: number): number {
    return messagesPerSecond * this.averageMessageBytes * 8;
  }

  private formatBitsPerSecond(bitsPerSecond: number): string {
    const absolute = Math.abs(bitsPerSecond);
    if (absolute >= 1_000_000_000) {
      return `${(bitsPerSecond / 1_000_000_000).toFixed(2)} Gbps est`;
    }
    if (absolute >= 1_000_000) {
      return `${(bitsPerSecond / 1_000_000).toFixed(2)} Mbps est`;
    }
    if (absolute >= 1_000) {
      return `${(bitsPerSecond / 1_000).toFixed(2)} Kbps est`;
    }
    return `${bitsPerSecond.toFixed(0)} bps est`;
  }

  private applyAverageMessageBytes(value: number): void {
    const normalized =
      Number.isFinite(value) && value > 0 ? Math.round(value) : 2048;
    this.averageMessageBytes = normalized;
    this.hideTooltip();
  }

  // Sampling interval handler for UI selector
  onSamplingIntervalChange(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) return;
    this.samplingInterval = Math.round(ms);
    this.samplingIntervalChange.emit(this.samplingInterval);
  }

  formatSamplingOption(ms: number): string {
    if (ms >= 1000) {
      const seconds = ms / 1000;
      return Number.isInteger(seconds)
        ? `${seconds} s`
        : `${seconds.toFixed(1)} s`;
    }
    return `${ms} ms`;
  }

  private areLegendItemsEqual(
    current: Array<{ label: string; color: string }>,
    next: Array<{ label: string; color: string }>,
  ): boolean {
    if (current.length !== next.length) {
      return false;
    }

    for (let index = 0; index < current.length; index += 1) {
      if (
        current[index].label !== next[index].label ||
        current[index].color !== next[index].color
      ) {
        return false;
      }
    }

    return true;
  }

  private syncSamplingIntervalFromInput(): void {
    const normalized =
      Number.isFinite(this.updateInterval) && this.updateInterval > 0
        ? Math.round(this.updateInterval)
        : 2000;
    this.samplingInterval = normalized;
    if (!this.samplingOptions.includes(normalized)) {
      this.samplingOptions = [normalized, ...this.samplingOptions];
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
