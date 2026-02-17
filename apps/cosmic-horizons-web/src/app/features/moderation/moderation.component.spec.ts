import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModerationComponent } from './moderation.component';
import { CommentsApiService, CommentReportModel } from '../posts/comments-api.service';

describe('ModerationComponent', () => {
  let component: ModerationComponent;
  let fixture: ComponentFixture<ModerationComponent>;
  let commentsApiService: any;

  const mockReports: CommentReportModel[] = [
    {
      id: 'report-1',
      comment_id: 'comment-1',
      user_id: 'user-2',
      reason: 'Spam',
      description: null,
      status: 'pending',
      created_at: '2026-02-12T00:00:00Z',
      user: {
        id: 'user-2',
        username: 'reporter',
        display_name: 'Reporter',
        email: null,
      },
      comment: {
        id: 'comment-1',
        post_id: 'post-1',
        user_id: 'user-1',
        parent_id: null,
        content: 'Spam content',
        created_at: '2026-02-12T00:00:00Z',
        updated_at: '2026-02-12T00:00:00Z',
        deleted_at: null,
        hidden_at: null,
      },
    },
    {
      id: 'report-2',
      comment_id: 'comment-2',
      user_id: 'user-3',
      reason: 'Offensive',
      description: null,
      status: 'pending',
      created_at: '2026-02-11T00:00:00Z',
      user: {
        id: 'user-3',
        username: 'other_user',
        display_name: 'Other User',
        email: null,
      },
      comment: {
        id: 'comment-2',
        post_id: 'post-2',
        user_id: 'user-1',
        parent_id: null,
        content: 'Offensive content',
        created_at: '2026-02-11T00:00:00Z',
        updated_at: '2026-02-11T00:00:00Z',
        deleted_at: null,
        hidden_at: null,
      },
    },
  ];

  beforeEach(async () => {
    const commentsApiSpy = {
      getAllReports: vi.fn().mockReturnValue(of([])),
      resolveReport: vi.fn(),
      hideComment: vi.fn(),
    };

    await TestBed.configureTestingModule({
      declarations: [ModerationComponent],
      imports: [
        CommonModule,
        MatIconModule,
        MatCardModule,
        MatTableModule,
        MatChipsModule,
        MatProgressSpinnerModule,
        MatButtonModule,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CommentsApiService, useValue: commentsApiSpy },
      ],
    }).compileComponents();

    commentsApiService = TestBed.inject(CommentsApiService);

    fixture = TestBed.createComponent(ModerationComponent);
    component = fixture.componentInstance;
  });

  describe('initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with empty reports', () => {
      expect(component.reports).toEqual([]);
    });

    it('should initialize with loading false', () => {
      expect(component.loading).toBe(false);
    });

    it('should initialize with empty error', () => {
      expect(component.error).toBe('');
    });

    it('should call loadReports on ngOnInit', () => {
      commentsApiService.getAllReports.mockReturnValue(of([]));
      vi.spyOn(component, 'loadReports');

      component.ngOnInit();

      expect(component.loadReports).toHaveBeenCalled();
    });
  });

  describe('loadReports()', () => {
    it('should populate reports on successful load', async () => {
      commentsApiService.getAllReports.mockReturnValue(of(mockReports));

      component.loadReports();
      await Promise.resolve();

      expect(component.reports).toEqual(mockReports);
    });

    it('should set loading to false after successful load', async () => {
      commentsApiService.getAllReports.mockReturnValue(of(mockReports));

      component.loadReports();
      await Promise.resolve();

      expect(component.loading).toBe(false);
    });

    it('should handle empty reports list', async () => {
      commentsApiService.getAllReports.mockReturnValue(of([]));

      component.loadReports();
      await Promise.resolve();

      expect(component.reports).toEqual([]);
      expect(component.loading).toBe(false);
    });

    it('should set error message on failure', async () => {
      commentsApiService.getAllReports.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      component.loadReports();
      await Promise.resolve();

      expect(component.error).toBe('Failed to load moderation reports.');
    });

    it('should set loading to false on error', async () => {
      commentsApiService.getAllReports.mockReturnValue(
        throwError(() => new Error('Server error'))
      );

      component.loadReports();
      await Promise.resolve();

      expect(component.loading).toBe(false);
    });

    it('should handle multiple consecutive loads', async () => {
      commentsApiService.getAllReports.mockReturnValue(of(mockReports));

      component.loadReports();
      await Promise.resolve();

      expect(component.reports.length).toBe(2);

      // Load again with different data
      const newReports = [mockReports[0]];
      commentsApiService.getAllReports.mockReturnValue(of(newReports));

      component.loadReports();
      await Promise.resolve();

      expect(component.reports.length).toBe(1);
      expect(component.reports[0].id).toBe('report-1');
    });
  });

  describe('resolveReport()', () => {
    beforeEach(() => {
      component.reports = mockReports;
    });

    it('should call resolveReport with correct parameters for reviewed status', async () => {
      commentsApiService.resolveReport.mockReturnValue(of({}));
      commentsApiService.getAllReports.mockReturnValue(of(mockReports));
      vi.spyOn(component, 'loadReports');

      component.resolveReport('report-1', 'reviewed');
      await Promise.resolve();

      expect(commentsApiService.resolveReport).toHaveBeenCalledWith('report-1', 'reviewed');
    });

    it('should call resolveReport with correct parameters for dismissed status', async () => {
      commentsApiService.resolveReport.mockReturnValue(of({}));
      commentsApiService.getAllReports.mockReturnValue(of(mockReports));

      component.resolveReport('report-1', 'dismissed');
      await Promise.resolve();

      expect(commentsApiService.resolveReport).toHaveBeenCalledWith('report-1', 'dismissed');
    });

    it('should reload reports after successful resolution', async () => {
      commentsApiService.resolveReport.mockReturnValue(of({}));
      commentsApiService.getAllReports.mockReturnValue(of(mockReports));
      vi.spyOn(component, 'loadReports');

      component.resolveReport('report-1', 'reviewed');
      await Promise.resolve();

      expect(component.loadReports).toHaveBeenCalled();
    });

    it('should set error message on resolution failure', async () => {
      commentsApiService.resolveReport.mockReturnValue(throwError(() => new Error('Failed')));

      component.resolveReport('report-1', 'reviewed');
      await Promise.resolve();

      expect(component.error).toBe('Failed to reviewed report.');
    });

    it('should include status in error message for dismissed', async () => {
      commentsApiService.resolveReport.mockReturnValue(throwError(() => new Error('Failed')));

      component.resolveReport('report-1', 'dismissed');
      await Promise.resolve();

      expect(component.error).toContain('dismissed');
    });

    it('should handle resolution of multiple reports', async () => {
      commentsApiService.resolveReport.mockReturnValue(of({}));
      commentsApiService.getAllReports.mockReturnValue(of(mockReports));
      vi.spyOn(component, 'loadReports').mockImplementation(() => {
        component.reports = mockReports;
      });

      component.resolveReport('report-1', 'reviewed');
      await Promise.resolve();

      component.resolveReport('report-2', 'dismissed');
      await Promise.resolve();

      // loadReports should be called for each resolveReport call (2 total in this test)
      expect(component.loadReports).toHaveBeenCalledTimes(2);
    });

    it('should handle consecutive resolutions with different statuses', async () => {
      commentsApiService.resolveReport.mockReturnValue(of({}));
      commentsApiService.getAllReports.mockReturnValue(of([]));
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      vi.spyOn(component, 'loadReports').mockImplementation(() => {});

      component.resolveReport('report-1', 'reviewed');
      await Promise.resolve();

      expect(component.error).toBe('');

      commentsApiService.resolveReport.mockReturnValue(throwError(() => new Error('Failed')));
      component.resolveReport('report-2', 'dismissed');
      await Promise.resolve();

      expect(component.error).toBe('Failed to dismissed report.');
    });
  });

  describe('hideComment()', () => {
    beforeEach(() => {
      component.reports = mockReports;
    });

    it('should call hideComment with correct comment id', async () => {
      commentsApiService.hideComment.mockReturnValue(of({}));
      commentsApiService.getAllReports.mockReturnValue(of(mockReports));

      component.hideComment('comment-1');
      await Promise.resolve();

      expect(commentsApiService.hideComment).toHaveBeenCalledWith('comment-1');
    });

    it('should reload reports after successful hide', async () => {
      commentsApiService.hideComment.mockReturnValue(of({}));
      commentsApiService.getAllReports.mockReturnValue(of(mockReports));
      vi.spyOn(component, 'loadReports');

      component.hideComment('comment-1');
      await Promise.resolve();

      expect(component.loadReports).toHaveBeenCalled();
    });

    it('should set error message on hide failure', async () => {
      commentsApiService.hideComment.mockReturnValue(throwError(() => new Error('Failed')));

      component.hideComment('comment-1');
      await Promise.resolve();

      expect(component.error).toBe('Failed to hide comment.');
    });

    it('should handle multiple consecutive hides', async () => {
      commentsApiService.hideComment.mockReturnValue(of({}));
      commentsApiService.getAllReports.mockReturnValue(of(mockReports));
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      vi.spyOn(component, 'loadReports').mockImplementation(() => {});

      component.hideComment('comment-1');
      await Promise.resolve();

      component.hideComment('comment-2');
      await Promise.resolve();

      expect(component.hideComment).toBeDefined();
      expect(commentsApiService.hideComment).toHaveBeenCalledTimes(2);
    });

    it('should update error on partial failure', async () => {
      commentsApiService.hideComment.mockReturnValue(of({}));
      commentsApiService.getAllReports.mockReturnValue(of(mockReports));

      component.hideComment('comment-1');
      await Promise.resolve();

      expect(component.error).toBe('');

      commentsApiService.hideComment.mockReturnValue(throwError(() => new Error('Not found')));
      component.hideComment('comment-99');
      await Promise.resolve();

      expect(component.error).toBe('Failed to hide comment.');
    });
  });

  describe('error handling and state management', () => {
    it('should set error on load failure', async () => {
      commentsApiService.getAllReports.mockReturnValue(
        throwError(() => new Error('Load failed'))
      );

      component.loadReports();
      await Promise.resolve();

      expect(component.error).toBe('Failed to load moderation reports.');
    });

    it('should preserve error when operation fails', async () => {
      commentsApiService.hideComment.mockReturnValue(throwError(() => new Error('Failed')));

      component.hideComment('comment-1');
      await Promise.resolve();

      expect(component.error).toBe('Failed to hide comment.');
    });

    it('should overwrite previous error with new error', async () => {
      component.error = 'Load error';
      commentsApiService.hideComment.mockReturnValue(throwError(() => new Error('Hide failed')));

      component.hideComment('comment-1');
      await Promise.resolve();

      expect(component.error).toBe('Failed to hide comment.');
    });

    it('should handle rapid sequential operations with errors', async () => {
      commentsApiService.resolveReport.mockReturnValue(throwError(() => new Error('Failed')));
      commentsApiService.hideComment.mockReturnValue(throwError(() => new Error('Failed')));

      component.resolveReport('report-1', 'reviewed');
      await Promise.resolve();

      expect(component.error).toContain('reviewed');

      component.hideComment('comment-1');
      await Promise.resolve();

      expect(component.error).toBe('Failed to hide comment.');
    });
  });

  describe('integration scenarios', () => {
    it('should load reports and then resolve one', async () => {
      commentsApiService.getAllReports.mockReturnValue(of(mockReports));
      commentsApiService.resolveReport.mockReturnValue(of({}));

      component.loadReports();
      await Promise.resolve();

      const initialCount = component.reports.length;
      expect(initialCount).toBe(2);

      component.resolveReport('report-1', 'reviewed');
      await Promise.resolve();

      expect(component.error).toBe('');
    });

    it('should handle full moderation workflow', async () => {
      commentsApiService.getAllReports.mockReturnValue(of(mockReports));
      commentsApiService.resolveReport.mockReturnValue(of({}));
      commentsApiService.hideComment.mockReturnValue(of({}));
      vi.spyOn(component, 'loadReports').mockImplementation(() => {
        component.reports = mockReports;
      });

      // Initial load
      component.loadReports();
      await Promise.resolve();
      expect(component.reports.length).toBe(2);

      // Resolve first report
      component.resolveReport('report-1', 'reviewed');
      await Promise.resolve();

      // Hide problematic comment
      component.hideComment('comment-2');
      await Promise.resolve();

      expect(component.error).toBe('');
    });
  });
});
