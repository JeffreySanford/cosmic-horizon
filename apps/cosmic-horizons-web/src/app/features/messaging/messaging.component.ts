/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, ElementRef, OnInit, ViewChild, OnDestroy, AfterViewInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ArraySite, ArrayElementStatus, MessagingLiveStats, MessagingService, TelemetryPacket } from '../../services/messaging.service';
import * as d3 from 'd3';
import { Subscription, take } from 'rxjs';

@Component({
  selector: 'app-messaging',
  standalone: false,
  templateUrl: './messaging.component.html',
  styleUrls: ['./messaging.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessagingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartContainer') chartContainer!: ElementRef;
  
  sites: ArraySite[] = [];
  elements: ArrayElementStatus[] = [];
  siteOperationalCounts: Map<string, number> = new Map(); // Track operational elements per site
  siteOfflineCounts: Map<string, number> = new Map(); // Track offline elements per site
  liveStats: MessagingLiveStats | null = null;
  
  private sitesLoaded = false;
  private elementsLoaded = false;
  private subscription: Subscription = new Subscription();
  private svg: any;
  private simulation: any;
  private width = 800;
  private height = 600;
  private readonly centralSiteId = 'site-1'; // Socorro Hub

  private messagingService = inject(MessagingService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    // Load topology once at startup
    this.loadDataOnce();
    
    // Listens for live telemetry updates at 10Hz
    this.subscription.add(
      this.messagingService.telemetry$.subscribe(update => {
        if (update.routeType === 'hub_to_hub') {
          this.animatePacket(update);
          this.updateChartDataOnly();
        } else {
          const element = this.elements.find(r => r.id === update.elementId);
          if (element) {
            const previousStatus = element.status;
            Object.assign(element, update.metrics);
            element.lastUpdate = update.timestamp;
            
            // Update site status counts if status changed
            if (previousStatus !== element.status) {
              this.updateSiteStatusCounts(element.siteId);
              this.cdr.markForCheck();
            }
            
            this.updateChartDataOnly();
            this.animatePacket(update);
          }
        }
      })
    );

    this.subscription.add(
      this.messagingService.stats$.subscribe((stats) => {
        this.liveStats = stats;
        this.cdr.markForCheck();
      }),
    );

    this.subscription.add(
      this.messagingService.getLiveStats().pipe(take(1)).subscribe((stats) => {
        this.liveStats = stats;
        this.cdr.markForCheck();
      }),
    );
  }

  private updateSiteStatusCounts(siteId: string) {
    const siteElements = this.elements.filter(e => e.siteId === siteId);
    const operational = siteElements.filter(e => e.status === 'operational').length;
    const offline = siteElements.filter(e => e.status === 'offline').length;
    
    this.siteOperationalCounts.set(siteId, operational);
    this.siteOfflineCounts.set(siteId, offline);
  }

  getSiteOperationalCount(siteId: string): number {
    return this.siteOperationalCounts.get(siteId) ?? 0;
  }

  getSiteOfflineCount(siteId: string): number {
    return this.siteOfflineCounts.get(siteId) ?? 0;
  }

  getSiteTotalCount(siteId: string): number {
    return this.elements.filter(e => e.siteId === siteId).length;
  }

  getActiveElementCount(): number {
    return this.elements.filter((element) => element.status === 'operational').length;
  }

  getMessagingStatusLabel(): string {
    if (!this.liveStats) {
      return 'Collecting transport stats...';
    }

    const rabbit = this.liveStats.infra.rabbitmq.connected ? 'RabbitMQ up' : 'RabbitMQ down';
    const kafka = this.liveStats.infra.kafka.connected ? 'Kafka up' : 'Kafka down';
    return `${rabbit} | ${kafka}`;
  }

  private animatePacket(packet: TelemetryPacket) {
    this.animateParticle(packet.sourceId, packet.targetId, packet.routeType === 'hub_to_hub');
  }

  private animateParticle(sourceId: string, targetId: string, isInterSite = false) {
    if (!this.svg) return;

    // Find nodes by ID
    const nodes = this.svg.selectAll('.node').data();
    const sourceNode: any = nodes.find((n: any) => n.id === sourceId);
    const targetNode: any = nodes.find((n: any) => n.id === targetId);

    if (!sourceNode || !targetNode) return;

    // Inter-site traffic is orange (larger, slower), element-to-site is blue (smaller, faster)
    const color = isInterSite ? '#ff9800' : '#58a6ff';
    const radius = isInterSite ? 5 : 3;
    const duration = isInterSite ? 1000 : 600; // Slightly longer durations

    // Create a group for the particle with glow effect
    const particleGroup = this.svg.insert('g', ':first-child')
      .attr('class', 'particle');

    // Glow/shadow effect for better visibility
    particleGroup.append('circle')
      .attr('r', radius + 2)
      .attr('fill', color)
      .attr('opacity', 0.15)
      .attr('cx', sourceNode.x)
      .attr('cy', sourceNode.y);

    // Main particle
    const particle = particleGroup.append('circle')
      .attr('r', radius)
      .attr('fill', color)
      .attr('opacity', 0.9)
      .attr('cx', sourceNode.x)
      .attr('cy', sourceNode.y);

    // Trail effect (optional, fades during animation)
    particle.transition()
      .duration(duration)
      .ease(d3.easeLinear)
      .attr('cx', targetNode.x)
      .attr('cy', targetNode.y)
      .attr('opacity', 0.3)
      .on('end', () => {
        particleGroup.remove();
      });

    // Animate glow
    particleGroup.select('circle:nth-child(1)')
      .transition()
      .duration(duration)
      .ease(d3.easeLinear)
      .attr('cx', targetNode.x)
      .attr('cy', targetNode.y)
      .attr('opacity', 0);
  }

  private updateChartDataOnly() {
    if (!this.svg) return;
    
    // Update node colors/radii based on new metadata without full re-render
    this.svg.selectAll('.node circle')
      .attr('fill', (d: any) => {
        if (d.type === 'site') return '#1976d2';
        return d.status === 'operational' ? '#4caf50' : '#f44336';
      });
  }

  ngAfterViewInit() {
    this.initChart();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    if (this.simulation) {
      this.simulation.stop();
    }
  }

  private loadDataOnce() {
    this.sitesLoaded = false;
    this.elementsLoaded = false;

    this.messagingService.getSites().pipe(take(1)).subscribe((sites: any) => {
      this.sites = sites as ArraySite[];
      this.sitesLoaded = true;
      this.cdr.markForCheck();
      if (this.sitesLoaded && this.elementsLoaded) {
        this.initializeSiteStatusCounts();
        this.updateChart();
        this.cdr.markForCheck();
      }
    });

    this.messagingService.getAllElements().pipe(take(1)).subscribe((elements: any) => {
      this.elements = elements as ArrayElementStatus[];
      this.elementsLoaded = true;
      this.initializeSiteStatusCounts();
      this.cdr.markForCheck();
      if (this.sitesLoaded && this.elementsLoaded) {
        this.updateChart();
        this.cdr.markForCheck();
      }
    });
  }

  private initializeSiteStatusCounts() {
    // Initialize status counts for all sites
    this.sites.forEach(site => {
      this.updateSiteStatusCounts(site.id);
    });
  }

  private initChart() {
    const element = this.chartContainer.nativeElement;
    this.width = element.offsetWidth || 800;
    this.height = element.offsetHeight || 600;

    this.svg = d3.select(element)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .append('g');

    // Add zoom behavior
    d3.select(element).select('svg').call(d3.zoom<any, any>().on('zoom', (event) => {
      this.svg.attr('transform', event.transform);
    }));

    this.simulation = d3.forceSimulation<any>()
      .force('link', d3.forceLink<any, any>().id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-150).distanceMax(400))
      .force('collide', d3.forceCollide<any>().radius((d: any) => d.type === 'site' ? 25 : 15).strength(0.8))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2).strength(0.3))
      .velocityDecay(0.4);
  }

  private updateChart() {
    if (!this.svg || this.sites.length === 0 || this.elements.length === 0) return;

    const nodes = [
      ...this.sites.map(s => ({ ...s, type: 'site', isCentral: s.id === this.centralSiteId })),
      ...this.elements.map(r => ({ ...r, type: 'element' }))
    ];

    // Element-to-site links
    const elementLinks = this.elements.map(r => ({
      source: r.id,
      target: r.siteId,
      linkType: 'element'
    }));

    // Site-to-site links (full mesh for hub-to-hub visibility)
    const siteLinks = this.sites.flatMap((sourceSite, sourceIndex) =>
      this.sites
        .slice(sourceIndex + 1)
        .map((targetSite) => ({
          source: sourceSite.id,
          target: targetSite.id,
          linkType: 'site',
        })),
    );

    const links = [...elementLinks, ...siteLinks];

    // Data join for links
    const link = this.svg.selectAll('.link')
      .data(links, (d: any) => `${d.source}-${d.target}`);

    link.exit().remove();

    const linkEnter = link.enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', (d: any) => d.linkType === 'site' ? '#ff9800' : '#444')
      .attr('stroke-width', (d: any) => d.linkType === 'site' ? 2 : 1)
      .attr('stroke-dasharray', (d: any) => d.linkType === 'site' ? '3,3' : '5,5');

    const linkUpdate = linkEnter.merge(link);

    // Data join for nodes
    const node = this.svg.selectAll('.node')
      .data(nodes, (d: any) => d.id);

    node.exit().remove();

    const nodeEnter = node.enter()
      .append('g')
      .attr('class', 'node')
      .call(d3.drag<any, any>()
        .on('start', (event: any, d: any) => {
          if (!event.active) this.simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event: any, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event: any, d: any) => {
          if (!event.active) this.simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    nodeEnter.append('circle')
      .attr('r', (d: any) => {
        if (d.type === 'site') {
          return d.isCentral ? 25 : 15; // Central site larger
        }
        return 6;
      })
      .attr('fill', (d: any) => {
        if (d.type === 'site') {
          return d.isCentral ? '#ff6f00' : '#1976d2'; // Central site orange
        }
        return '#4caf50';
      })
      .attr('stroke', (d: any) => d.isCentral ? '#fff' : 'none')
      .attr('stroke-width', (d: any) => d.isCentral ? 3 : 0);

    nodeEnter.append('text')
      .attr('dy', (d: any) => d.type === 'site' ? (d.isCentral ? 35 : 25) : 15)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .style('font-size', (d: any) => d.isCentral ? '11px' : '10px')
      .style('font-weight', (d: any) => d.isCentral ? 'bold' : 'normal')
      .text((d: any) => d.name.split(',')[0]);

    const nodeUpdate = nodeEnter.merge(node);

    // Animation for data flow
    nodeUpdate.selectAll('circle')
      .transition()
      .duration(500)
      .attr('fill', (d: any) => {
        if (d.type === 'site') {
          return d.isCentral ? '#ff6f00' : '#1976d2';
        }
        return d.status === 'operational' ? '#4caf50' : '#f44336';
      });

    this.simulation.nodes(nodes);
    this.simulation.force('link').links(links);
    this.simulation.on('tick', () => {
      linkUpdate
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeUpdate
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    this.simulation.alpha(1).restart();
  }
}
