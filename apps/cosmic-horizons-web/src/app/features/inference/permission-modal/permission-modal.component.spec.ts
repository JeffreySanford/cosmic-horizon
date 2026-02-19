import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { PermissionModalComponent } from './permission-modal.component';
import { InferenceModule } from '../inference.module';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('PermissionModalComponent', () => {
  let component: PermissionModalComponent;
  let fixture: ComponentFixture<PermissionModalComponent>;
  let mockDialogRef: any;

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InferenceModule],
      providers: [{ provide: MatDialogRef, useValue: mockDialogRef }],
    }).compileComponents();

    fixture = TestBed.createComponent(PermissionModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onAllow', () => {
    it('should close dialog with true', () => {
      component.onAllow();
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });
  });

  describe('onDeny', () => {
    it('should close dialog with false', () => {
      component.onDeny();
      expect(mockDialogRef.close).toHaveBeenCalledWith(false);
    });
  });
});
