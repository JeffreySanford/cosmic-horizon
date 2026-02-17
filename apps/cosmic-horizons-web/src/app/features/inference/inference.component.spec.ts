import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { InferenceComponent } from './inference.component';
import { PermissionModalComponent } from './permission-modal/permission-modal.component';
import { InferenceModule } from './inference.module';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('InferenceComponent', () => {
  let component: InferenceComponent;
  let fixture: ComponentFixture<InferenceComponent>;
  let mockDialog: any;

  beforeEach(async () => {
    mockDialog = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InferenceModule],
      providers: [
        { provide: MatDialog, useValue: mockDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InferenceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have agents initialized', () => {
    expect(component.agents.length).toBe(3);
    expect(component.agents[0].name).toBe('AlphaCal');
  });

  it('should have active sessions', () => {
    expect(component.activeSessions.length).toBeGreaterThan(0);
    expect(component.activeSessions[0].agentName).toBe('AlphaCal');
  });

  describe('toggleExpanded', () => {
    it('should show permission modal on first expand', () => {
      const dialogRef = {
        afterClosed: () => of(true),
      };
      mockDialog.open.mockReturnValue(dialogRef);

      component.isExpanded = false;
      component.hasPermission = false;

      component.toggleExpanded();

      expect(mockDialog.open).toHaveBeenCalledWith(PermissionModalComponent, {
        width: '400px',
        disableClose: false,
      });
    });

    it('should set permission and expand after modal allows', async () => {
      const dialogRef = {
        afterClosed: () => of(true),
      };
      mockDialog.open.mockReturnValue(dialogRef);

      component.isExpanded = false;
      component.hasPermission = false;

      component.toggleExpanded();

      await Promise.resolve();

      expect(component.hasPermission).toBe(true);
      expect(component.isExpanded).toBe(true);
    });

    it('should not expand if modal denies', async () => {
      const dialogRef = {
        afterClosed: () => of(false),
      };
      mockDialog.open.mockReturnValue(dialogRef);

      component.isExpanded = false;
      component.hasPermission = false;

      component.toggleExpanded();

      await Promise.resolve();

      expect(component.hasPermission).toBe(false);
      expect(component.isExpanded).toBe(false);
    });

    it('should toggle expanded state if already has permission', () => {
      component.isExpanded = false;
      component.hasPermission = true;

      component.toggleExpanded();

      expect(component.isExpanded).toBe(true);

      component.toggleExpanded();

      expect(component.isExpanded).toBe(false);
    });
  });

  describe('getStatusColor', () => {
    it('should return green for running status', () => {
      const color = component.getStatusColor('running');
      expect(color).toBe('#3fb950');
    });

    it('should return gray for idle status', () => {
      const color = component.getStatusColor('idle');
      expect(color).toBe('#8b949e');
    });

    it('should return red for failed status', () => {
      const color = component.getStatusColor('failed');
      expect(color).toBe('#f85149');
    });

    it('should return default color for unknown status', () => {
      const color = component.getStatusColor('unknown');
      expect(color).toBe('#c9d1d9');
    });
  });

  describe('formatThroughput', () => {
    it('should format throughput with GB/s unit', () => {
      const formatted = component.formatThroughput(8.3);
      expect(formatted).toBe('8300 GB/s');
    });

    it('should handle zero throughput', () => {
      const formatted = component.formatThroughput(0);
      expect(formatted).toBe('0 GB/s');
    });

    it('should round to nearest integer', () => {
      const formatted = component.formatThroughput(12.567);
      expect(formatted).toBe('12567 GB/s');
    });
  });
});
