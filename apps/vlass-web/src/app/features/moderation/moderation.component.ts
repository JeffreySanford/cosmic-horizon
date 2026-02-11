import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommentsApiService, CommentReportModel } from '../posts/comments-api.service';

@Component({
  selector: 'app-moderation',
  templateUrl: './moderation.component.html',
  styleUrls: ['./moderation.component.scss'],
  standalone: false, // eslint-disable-line @angular-eslint/prefer-standalone
})
export class ModerationComponent implements OnInit {
  reports: CommentReportModel[] = [];
  loading = false;
  error = '';

  private readonly commentsApi = inject(CommentsApiService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {
    this.loading = true;
    this.commentsApi.getAllReports()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reports) => {
          this.reports = reports;
          this.loading = false;
        },
        error: () => {
          this.error = 'Failed to load moderation reports.';
          this.loading = false;
        }
      });
  }

  resolveReport(reportId: string, status: 'reviewed' | 'dismissed'): void {
    this.commentsApi.resolveReport(reportId, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadReports();
        },
        error: () => {
          this.error = `Failed to ${status} report.`;
        }
      });
  }

  hideComment(commentId: string): void {
    this.commentsApi.hideComment(commentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadReports();
        },
        error: () => {
          this.error = 'Failed to hide comment.';
        }
      });
  }
}
