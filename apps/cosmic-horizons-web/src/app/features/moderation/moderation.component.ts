import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, of, timeout } from 'rxjs';
import {
  CommentsApiService,
  CommentReportModel,
} from '../posts/comments-api.service';

@Component({
  selector: 'app-moderation',
  templateUrl: './moderation.component.html',
  styleUrls: ['./moderation.component.scss'],
  standalone: false,
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
    this.error = '';
    this.loading = true;
    this.commentsApi
      .getAllReports()
      .pipe(
        timeout(10000),
        catchError(() => {
          this.error = 'Failed to load moderation reports.';
          return of([] as CommentReportModel[]);
        }),
        finalize(() => {
          this.loading = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (reports) => {
          this.reports = reports;
        },
      });
  }

  resolveReport(reportId: string, status: 'reviewed' | 'dismissed'): void {
    this.commentsApi
      .resolveReport(reportId, status)
      .pipe(timeout(10000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadReports();
        },
        error: () => {
          this.error = `Failed to ${status} report.`;
        },
      });
  }

  hideComment(commentId: string): void {
    this.commentsApi
      .hideComment(commentId)
      .pipe(timeout(10000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadReports();
        },
        error: () => {
          this.error = 'Failed to hide comment.';
        },
      });
  }
}
