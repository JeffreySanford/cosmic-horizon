import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NodePerformanceComponent } from './node-performance.component';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

describe('NodePerformanceComponent', () => {
  let component: NodePerformanceComponent;
  let fixture: ComponentFixture<NodePerformanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FormsModule,
        MatCardModule,
        MatSlideToggleModule,
        NodePerformanceComponent,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NodePerformanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('toggles GPU view when toggleView called', () => {
    expect(component.showGpu).toBe(false);
    component.toggleView();
    expect(component.showGpu).toBe(true);
  });
});