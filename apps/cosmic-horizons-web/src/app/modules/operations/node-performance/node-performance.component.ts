import { Component } from '@angular/core';

@Component({
  selector: 'app-node-performance',
  templateUrl: './node-performance.component.html',
  styleUrls: ['./node-performance.component.scss'],
  standalone: false,
  // this component is declared in OperationsModule, which supplies necessary imports

})
export class NodePerformanceComponent {
  showGpu = false;

  toggleView(): void {
    this.showGpu = !this.showGpu;
  }
}