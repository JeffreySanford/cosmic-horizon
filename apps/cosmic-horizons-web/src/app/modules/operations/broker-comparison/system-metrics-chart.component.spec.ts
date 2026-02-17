import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SystemMetricsChartComponent } from './system-metrics-chart.component';

describe('SystemMetricsChartComponent', () => {
  let fixture: ComponentFixture<SystemMetricsChartComponent>;
  let component: SystemMetricsChartComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SystemMetricsChartComponent],
      imports: [CommonModule],
    }).compileComponents();

    fixture = TestBed.createComponent(SystemMetricsChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should default to 2 KB payload assumption', () => {
    expect(component.averageMessageBytes).toBe(2048);
    expect(component.messageSizePreset).toBe('2048');
  });

  it('should initialize with system legend items', () => {
    expect(component.legendItems).toEqual([
      { label: 'CPU Usage', color: '#ff6b6b' },
      { label: 'Memory Usage', color: '#4ecdc4' },
      { label: 'Disk I/O', color: '#45b7d1' },
    ]);
  });

  it('should switch payload preset and update bitrate basis', () => {
    component.onMessageSizePresetChange('65536');
    expect(component.messageSizePreset).toBe('65536');
    expect(component.averageMessageBytes).toBe(65536);

    const bits = (component as any).toBitsPerSecond(1000);
    expect(bits).toBe(524288000);
    expect((component as any).formatBitsPerSecond(bits)).toContain('Mbps');
  });

  it('should apply custom payload bytes when custom mode is selected', () => {
    component.onMessageSizePresetChange('custom');
    component.onCustomMessageBytesChange('12345');
    expect(component.messageSizePreset).toBe('custom');
    expect(component.customMessageBytes).toBe(12345);
    expect(component.averageMessageBytes).toBe(12345);
  });

  it('should ignore invalid custom payload values', () => {
    const before = component.averageMessageBytes;
    component.onMessageSizePresetChange('custom');
    component.onCustomMessageBytesChange('0');
    component.onCustomMessageBytesChange('-10');
    component.onCustomMessageBytesChange('NaN');
    expect(component.averageMessageBytes).toBe(before);
  });
});
