import { Component, OnInit, inject } from '@angular/core';
import { CommunityApiService, DiscoveryModel } from './community-api.service';

@Component({
  selector: 'app-community-moderation',
  templateUrl: './moderation.component.html',
  styleUrls: ['./moderation.component.scss'],
  standalone: false
})
export class ModerationComponent implements OnInit {
  pending: DiscoveryModel[] = [];
  loading = false;

  private readonly api = inject(CommunityApiService);

  ngOnInit(): void {
    this.loadPending();
  }

  loadPending() {
    this.loading = true;
    this.api.getPending().subscribe({
      next: (items) => {
        this.pending = items;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  approve(item: DiscoveryModel) {
    this.api.approvePost(item.id).subscribe({
      next: () => this.loadPending(),
    });
  }

  hide(item: DiscoveryModel) {
    this.api.hidePost(item.id).subscribe({
      next: () => this.loadPending(),
    });
  }
}
