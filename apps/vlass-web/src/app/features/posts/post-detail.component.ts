import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { PostsApiService, PostModel } from './posts-api.service';

@Component({
  selector: 'app-post-detail',
  templateUrl: './post-detail.component.html',
  styleUrl: './post-detail.component.scss',
  standalone: false, // eslint-disable-line @angular-eslint/prefer-standalone
})
export class PostDetailComponent implements OnInit {
  post: PostModel | null = null;
  loading = false;
  publishing = false;
  statusMessage = '';
  viewMode: 'formatted' | 'raw' = 'formatted';

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly postsApi = inject(PostsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/posts']);
      return;
    }

    this.loading = true;
    this.postsApi
      .getPostById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (post) => {
          this.post = post;
          this.loading = false;
        },
        error: (error: HttpErrorResponse) => {
          this.loading = false;
          this.statusMessage = typeof error.error?.message === 'string' ? error.error.message : 'Post was not found.';
        },
      });
  }

  publish(): void {
    if (!this.post || this.post.status === 'published' || this.publishing) {
      return;
    }

    this.publishing = true;
    this.postsApi
      .publishPost(this.post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (post) => {
          this.post = post;
          this.publishing = false;
          this.statusMessage = 'Post published.';
        },
        error: (error: HttpErrorResponse) => {
          this.publishing = false;
          this.statusMessage =
            typeof error.error?.message === 'string' ? error.error.message : 'Failed to publish post.';
        },
      });
  }

  copyShareLink(): void {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    const url = window.location.href;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        this.statusMessage = 'Share link copied.';
      })
      .catch(() => {
        this.statusMessage = 'Failed to copy link.';
      });
  }

  get formattedContent(): SafeHtml {
    const content = String(this.post?.content || '');
    const escaped = this.escapeHtml(content);
    const withViewerBlocks = escaped.replace(
      /```viewer\s*([\s\S]*?)```/g,
      (_full, rawJson: string) => {
        const encoded = this.tryEncodeViewerBlock(rawJson);
        if (!encoded) {
          return `<div class="preview-viewer-block invalid">Invalid viewer block</div>`;
        }
        return `<div class="preview-viewer-block"><a href="/view?state=${encoded}" target="_blank" rel="noopener">Open embedded viewer block</a></div>`;
      },
    );

    const withHeadings = withViewerBlocks
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>');

    const withInline = withHeadings
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    const withParagraphs = withInline
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0)
      .map((block) => {
        if (/^<h[1-3]>/.test(block) || /^<div class="preview-viewer-block/.test(block)) {
          return block;
        }
        return `<p>${block.replace(/\n/g, '<br />')}</p>`;
      })
      .join('');

    return this.sanitizer.bypassSecurityTrustHtml(withParagraphs);
  }

  private tryEncodeViewerBlock(rawJson: string): string | null {
    try {
      const parsed = JSON.parse(rawJson.trim()) as { ra?: unknown; dec?: unknown; fov?: unknown; survey?: unknown };
      return btoa(
        JSON.stringify({
          ra: Number(parsed.ra),
          dec: Number(parsed.dec),
          fov: Number(parsed.fov),
          survey: String(parsed.survey || 'VLASS'),
        }),
      )
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    } catch {
      return null;
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
