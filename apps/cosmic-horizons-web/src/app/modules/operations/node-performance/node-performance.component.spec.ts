import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OperationsModule } from '../operations.module';
import { NodePerformanceComponent } from './node-performance.component';

describe('NodePerformanceComponent', () => {
  let component: NodePerformanceComponent;
  let fixture: ComponentFixture<NodePerformanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperationsModule],
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