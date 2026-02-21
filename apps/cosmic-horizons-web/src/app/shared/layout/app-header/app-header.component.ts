import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
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
export class AppHeaderComponent implements OnChanges {
  @Input() config: AppHeaderConfig = DEFAULT_APP_HEADER_CONFIG;
  @Output() menuAction = new EventEmitter<string>();
  isExpanded = false;

  // expose toggle service for template binding
  mockMode = inject(MockModeService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) {
      this.isExpanded = !!this.config.expandedByDefault;
    }
  }

  trackBreadcrumb(index: number, breadcrumb: AppHeaderBreadcrumb): string {
    return breadcrumb.route ?? `${breadcrumb.label}-${index}`;
  }

  onMenuAction(item: AppHeaderMenuItem): void {
    if (item.action) {
      this.menuAction.emit(item.action);
    }
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }
}
