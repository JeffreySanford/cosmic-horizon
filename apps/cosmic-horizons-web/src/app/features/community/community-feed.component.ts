import { Component, OnInit } from '@angular/core';
import { CommunityApiService, DiscoveryModel } from './community-api.service';

@Component({
  selector: 'app-community-feed',
  templateUrl: './community-feed.component.html',
  styleUrls: ['./community-feed.component.scss'],
})
export class CommunityFeedComponent implements OnInit {
  feed: DiscoveryModel[] = [];
  newTitle = '';
  newBody = '';

  constructor(private readonly api: CommunityApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getFeed().subscribe((f) => (this.feed = f));
  }

  create(): void {
    if (!this.newTitle.trim()) return;
    this.api.createPost({ title: this.newTitle, body: this.newBody }).subscribe((created) => {
      this.newTitle = '';
      this.newBody = '';
      this.load();
    });
  }
}
