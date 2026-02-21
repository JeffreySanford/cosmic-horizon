import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import {
  AppHeaderBreadcrumb,
  AppHeaderConfig,
  AppHeaderMenuItem,
  DEFAULT_APP_HEADER_CONFIG,
} from './app-header.types';
import { MockModeService } from '../../../services/mock-mode.service';

@Component({
  selector: 'app-header',
  templateUrl: './app-header.component.html',
  styleUrls: ['./app-header.component.scss'],
  standalone: false,
})
export class AppHeaderComponent {
  @Input() config: AppHeaderConfig = DEFAULT_APP_HEADER_CONFIG;
  @Input()
  set expanded(value: boolean) {
    this._expanded = !!value;
  }
  get expanded(): boolean {
    return this._expanded;
  }
  @Output() menuAction = new EventEmitter<string>();
  @Output() expandedChange = new EventEmitter<boolean>();
  private _expanded = false;

  // expose toggle service for template binding
  mockMode = inject(MockModeService);

  trackBreadcrumb(index: number, breadcrumb: AppHeaderBreadcrumb): string {
    return breadcrumb.route ?? `${breadcrumb.label}-${index}`;
  }

  onMenuAction(item: AppHeaderMenuItem): void {
    if (item.action) {
      this.menuAction.emit(item.action);
    }
  }

  toggleExpanded(): void {
    const next = !this._expanded;
    this._expanded = next;
    this.expandedChange.emit(next);
  }
}
