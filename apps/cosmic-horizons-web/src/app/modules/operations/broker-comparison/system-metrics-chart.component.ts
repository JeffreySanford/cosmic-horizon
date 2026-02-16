import { Component, ElementRef, ViewChild, OnInit, OnDestroy, Input } from '@angular/core';
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

@Component({
  selector: 'app-system-metrics-chart',
  standalone: false,
  template: `
    <div class="system-metrics-chart">
      <div class="chart-header">
        <h3>System Resource Monitor</h3>
        <div class="legend">
          <div class="legend-item">
            <div class="legend-color cpu"></div>
            <span>CPU Usage</span>
          </div>
          <div class="legend-item">
            <div class="legend-color memory"></div>
            <span>Memory Usage</span>
          </div>
          <div class="legend-item">
            <div class="legend-color disk"></div>
            <span>Disk I/O</span>
          </div>
        </div>
      </div>
      <div #chartContainer class="chart-container"></div>
    </div>
  `,
  styles: [`
    .system-metrics-chart {
      background: white;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin: 16px 0;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .chart-header h3 {
      margin: 0;
      color: #333;
      font-size: 18px;
      font-weight: 500;
    }

    .legend {
      display: flex;
      gap: 16px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #666;
    }

    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }

    .legend-color.cpu { background-color: #ff6b6b; }
    .legend-color.memory { background-color: #4ecdc4; }
    .legend-color.disk { background-color: #45b7d1; }

    .chart-container {
      width: 100%;
      height: 300px;
      position: relative;
    }

    .axis text {
      font-size: 11px;
      fill: #666;
    }

    .axis line,
    .axis path {
      stroke: #ddd;
    }

    .grid line {
      stroke: #f0f0f0;
      stroke-dasharray: 2,2;
    }

    .line {
      fill: none;
      stroke-width: 2;
    }

    .line.cpu { stroke: #ff6b6b; }
    .line.memory { stroke: #4ecdc4; }
    .line.disk { stroke: #45b7d1; }

    .tooltip {
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
    }
  `]
})
/* eslint-disable @typescript-eslint/no-explicit-any */
export class SystemMetricsChartComponent implements OnInit, OnDestroy {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;
  @Input() maxDataPoints = 50;
  @Input() updateInterval = 2000; // 2 seconds

  private data: SystemMetric[] = [];
  private svg: any;
  private xScale: any;
  private yScale: any;
  private xAxis: any;
  private yAxis: any;
  private lineGenerators: any = {};
  private paths: any = {};
  private tooltip: any;
  private updateTimer: any;

  private margin = { top: 20, right: 80, bottom: 40, left: 60 };
  private width = 0;
  private height = 0;

  ngOnInit() {
    this.initializeChart();
    this.startDataUpdates();
  }

  ngOnDestroy() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
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
      cpu = Number((metrics.cpu as number));
      memory = Number((metrics.memory as number));
      disk = Number((metrics.disk as number));
    }

    // Skip invalid data points
    if (isNaN(cpu) || isNaN(memory) || isNaN(disk) ||
        !isFinite(cpu) || !isFinite(memory) || !isFinite(disk)) {
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
    if (this.data.length > 50) {
      this.data.shift();
    }

    // Update the chart
    this.updateChart();
  }

  private initializeChart() {
    const element = this.chartContainer.nativeElement;
    this.width = element.clientWidth - this.margin.left - this.margin.right;
    this.height = element.clientHeight - this.margin.top - this.margin.bottom;

    this.svg = d3.select(element)
      .append('svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom)
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    // Add background rectangle
    this.svg.append('rect')
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
    this.svg.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(this.yScale).ticks(5).tickSize(-this.width).tickFormat('' as any));

    // Add axes
    this.svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.height})`)
      .call(this.xAxis);

    this.svg.append('g')
      .attr('class', 'y-axis')
      .call(this.yAxis);

    // Add Y axis label
    this.svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - this.margin.left)
      .attr('x', 0 - (this.height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('fill', '#666')
      .style('font-size', '12px')
      .text('Usage (%)');

    // Create line generators
    this.lineGenerators = {
      cpu: d3.line<SystemMetric>()
        .x(d => this.xScale(d.timestamp))
        .y(d => this.yScale(d.cpu))
        .curve(d3.curveMonotoneX),
      memory: d3.line<SystemMetric>()
        .x(d => this.xScale(d.timestamp))
        .y(d => this.yScale(d.memory))
        .curve(d3.curveMonotoneX),
      disk: d3.line<SystemMetric>()
        .x(d => this.xScale(d.timestamp))
        .y(d => this.yScale(d.disk))
        .curve(d3.curveMonotoneX)
    };

    // Create paths
    this.paths = {
      cpu: this.svg.append('path').attr('class', 'line cpu'),
      memory: this.svg.append('path').attr('class', 'line memory'),
      disk: this.svg.append('path').attr('class', 'line disk')
    };

    // Create tooltip
    this.tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);

    // Add mouse tracking for tooltip
    this.svg.append('rect')
      .attr('width', this.width)
      .attr('height', this.height)
      .style('fill', 'none')
      .style('pointer-events', 'all')
      .on('mousemove', (event: MouseEvent) => this.showTooltip(event))
      .on('mouseout', () => this.hideTooltip());
  }

  private startDataUpdates() {
    // Generate initial data
    for (let i = 0; i < 10; i++) {
      this.addDataPoint();
    }

    // Update chart initially
    this.updateChart();

    // Start periodic updates
    this.updateTimer = setInterval(() => {
      this.addDataPoint();
      this.updateChart();
    }, this.updateInterval);
  }

  private addDataPoint() {
    const now = new Date();
    const newPoint: SystemMetric = {
      timestamp: now,
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100
    };

    this.data.push(newPoint);

    // Keep only the last maxDataPoints
    if (this.data.length > this.maxDataPoints) {
      this.data.shift();
    }
  }

  private updateChart() {
    if (this.data.length === 0) return;

    // Update scales
    const timeExtent = d3.extent(this.data, d => d.timestamp) as [Date, Date];
    this.xScale.domain(timeExtent);

    // Update axes
    this.svg.select('.x-axis').call(this.xAxis);
    this.svg.select('.y-axis').call(this.yAxis);

    // Update paths
    this.paths.cpu.datum(this.data).attr('d', this.lineGenerators.cpu);
    this.paths.memory.datum(this.data).attr('d', this.lineGenerators.memory);
    this.paths.disk.datum(this.data).attr('d', this.lineGenerators.disk);
  }

  private showTooltip(event: MouseEvent) {
    const [mouseX] = d3.pointer(event);
    const x0 = this.xScale.invert(mouseX);
    const bisect = d3.bisector((d: SystemMetric) => d.timestamp).left;
    const i = bisect(this.data, x0, 1);
    const d0 = this.data[i - 1];
    const d1 = this.data[i];
    const d = x0.getTime() - d0.timestamp.getTime() > d1.timestamp.getTime() - x0.getTime() ? d1 : d0;

    this.tooltip
      .style('opacity', 1)
      .html(`
        <div><strong>${d.timestamp.toLocaleTimeString()}</strong></div>
        <div>CPU: ${d.cpu.toFixed(1)}%</div>
        <div>Memory: ${d.memory.toFixed(1)}%</div>
        <div>Disk I/O: ${d.disk.toFixed(1)}%</div>
      `)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 10) + 'px');
  }

  private hideTooltip() {
    this.tooltip.style('opacity', 0);
  }

  // Method to update data from external source
  updateMetrics(cpu: number, memory: number, disk: number) {
    // Validate that all metric values are valid numbers
    const cpuVal = Number(cpu);
    const memoryVal = Number(memory);
    const diskVal = Number(disk);

    // Skip invalid data points
    if (isNaN(cpuVal) || isNaN(memoryVal) || isNaN(diskVal) ||
        !isFinite(cpuVal) || !isFinite(memoryVal) || !isFinite(diskVal)) {
      console.warn('Skipping invalid system metrics data:', { cpu, memory, disk });
      return;
    }

    const newPoint: SystemMetric = {
      timestamp: new Date(),
      cpu: cpuVal,
      memory: memoryVal,
      disk: diskVal
    };

    this.data.push(newPoint);

    if (this.data.length > this.maxDataPoints) {
      this.data.shift();
    }

    this.updateChart();
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */