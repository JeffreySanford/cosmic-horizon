import { Component, OnInit, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MessagingService } from './services/messaging.service';
import type { EventBase } from '@cosmic-horizons/event-models';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  standalone: false,
})
export class App implements OnInit {
  protected title = 'cosmic-horizons-web';
  private readonly messaging = inject(MessagingService);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    // Global toast for notification events (e.g. community.discovery.created)
    this.messaging.notifications$.subscribe((payload: EventBase) => {
      try {
        const type = payload?.type ?? payload?.event_type ?? '';
        if (type === 'community.discovery.created') {
          const title = (payload?.payload as any)?.title ?? 'New discovery';
          this.snackBar.open(`Community: ${title}`, 'View', { duration: 5000 });
        }
      } catch {
        // swallow UI notification errors
      }
    });
  }
}
