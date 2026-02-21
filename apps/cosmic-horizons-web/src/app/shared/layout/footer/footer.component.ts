import { Component, Input } from '@angular/core';
import {
  AppHeaderConfig,
  DEFAULT_APP_HEADER_CONFIG,
} from '../app-header/app-header.types';

interface FooterRouteMeta {
  icon: string;
  label: string;
}

@Component({
  selector: 'app-footer',
  standalone: false,
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent {
  @Input() config: AppHeaderConfig = DEFAULT_APP_HEADER_CONFIG;

  get currentRouteMeta(): FooterRouteMeta {
    const icon = this.config.icon || DEFAULT_APP_HEADER_CONFIG.icon;
    const label = this.config.title || DEFAULT_APP_HEADER_CONFIG.title;
    return { icon, label };
  }
}
