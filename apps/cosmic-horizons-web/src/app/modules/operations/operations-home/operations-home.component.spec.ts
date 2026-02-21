import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MatListModule } from '@angular/material/list';
import { beforeEach, describe, expect, it } from 'vitest';
import { OperationsHomeComponent } from './operations-home.component';

describe('OperationsHomeComponent', () => {
  let fixture: ComponentFixture<OperationsHomeComponent>;
  let component: OperationsHomeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OperationsHomeComponent],
      imports: [RouterTestingModule, MatListModule],
    }).compileComponents();

    fixture = TestBed.createComponent(OperationsHomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders list of operation links', () => {
    expect(component).toBeTruthy();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Broker Comparison');
    expect(text).toContain('Job Dashboard');
    expect(text).toContain('Node Performance');
    expect(text).toContain('Load Tests');
  });
});
