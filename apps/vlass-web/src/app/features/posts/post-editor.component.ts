import { Component, DestroyRef, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PostsApiService } from './posts-api.service';
import { renderSafeMarkdownHtml } from './markdown-renderer';

interface ParsedViewerBlock {
  raw: string;
  encodedState: string;
}

@Component({
  selector: 'app-post-editor',
  templateUrl: './post-editor.component.html',
  styleUrls: ['./post-editor.component.scss'],
  standalone: false, // eslint-disable-line @angular-eslint/prefer-standalone
})
export class PostEditorComponent {
  readonly editorForm = inject(FormBuilder).group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    content: ['', [Validators.required, Validators.minLength(20)]],
  });
  saving = false;
  statusMessage = '';
  viewerBlocks: ParsedViewerBlock[] = [];
  showBlockBuilder = false;
  readonly blockBuilderForm = inject(FormBuilder).group({
    ra: [187.25, [Validators.required]],
    dec: [2.05, [Validators.required]],
    fov: [1.5, [Validators.required, Validators.min(0.001)]],
    survey: ['VLASS', [Validators.required]],
    label: [''],
  });
  readonly surveyOptions = ['VLASS', 'DSS2', '2MASS', 'P/PanSTARRS/DR1/color-z-zg-g'];

  private readonly postsApi = inject(PostsApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  saveDraft(): void {
    if (this.editorForm.invalid) {
      this.statusMessage = 'Please enter a valid title and content.';
      return;
    }

    this.saving = true;
    const payload = {
      title: String(this.editorForm.value.title),
      content: String(this.editorForm.value.content),
    };
    this.postsApi
      .createPost(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (post) => {
          this.saving = false;
          this.statusMessage = 'Draft saved.';
          this.router.navigate(['/posts', post.id]);
        },
        error: (error: HttpErrorResponse) => {
          this.saving = false;
          this.statusMessage =
            typeof error.error?.message === 'string' ? error.error.message : 'Failed to save draft.';
        },
      });
  }

  parseViewerBlocks(): void {
    const content = String(this.editorForm.value.content || '');
    const blocks: ParsedViewerBlock[] = [];
    const regex = /```viewer\s*([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    match = regex.exec(content);
    while (match) {
      const rawJson = match[1].trim();
      try {
        const parsed = JSON.parse(rawJson) as { ra?: unknown; dec?: unknown; fov?: unknown; survey?: unknown };
        const encodedState = this.encodeState({
          ra: Number(parsed.ra),
          dec: Number(parsed.dec),
          fov: Number(parsed.fov),
          survey: String(parsed.survey || 'VLASS'),
        });
        blocks.push({ raw: rawJson, encodedState });
      } catch {
        // Skip invalid viewer blocks in preview.
      }
      match = regex.exec(content);
    }

    this.viewerBlocks = blocks;
    this.statusMessage =
      blocks.length > 0
        ? `Parsed ${blocks.length} viewer block${blocks.length === 1 ? '' : 's'}.`
        : 'No valid viewer blocks found.';
  }

  openBlockBuilder(): void {
    this.showBlockBuilder = true;
  }

  closeBlockBuilder(): void {
    this.showBlockBuilder = false;
  }

  insertViewerBlock(): void {
    if (this.blockBuilderForm.invalid) {
      this.statusMessage = 'Fill all viewer block inputs before inserting.';
      return;
    }

    const block = {
      ra: Number(this.blockBuilderForm.value.ra),
      dec: Number(this.blockBuilderForm.value.dec),
      fov: Number(this.blockBuilderForm.value.fov),
      survey: String(this.blockBuilderForm.value.survey),
      label: String(this.blockBuilderForm.value.label || '').trim() || undefined,
    };
    const blockJson = JSON.stringify(block, null, 2);
    const blockMarkdown = `\n\`\`\`viewer\n${blockJson}\n\`\`\`\n`;
    const existing = String(this.editorForm.value.content || '');

    this.editorForm.patchValue({ content: `${existing}${blockMarkdown}` });
    this.parseViewerBlocks();
    this.showBlockBuilder = false;
    this.statusMessage = 'Viewer block inserted.';
  }

  insertMarkdown(prefix: string, suffix = ''): void {
    const content = String(this.editorForm.value.content || '');
    this.editorForm.patchValue({ content: `${content}${prefix}${suffix}` });
  }

  get characterCount(): number {
    return String(this.editorForm.value.content || '').length;
  }

  get estimatedReadMinutes(): number {
    const words = String(this.editorForm.value.content || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 220));
  }

  get previewHtml(): string {
    const content = String(this.editorForm.value.content || '');
    return renderSafeMarkdownHtml(content, (rawJson: string) => {
        const encoded = this.tryEncodeViewerBlock(rawJson);
        if (!encoded) {
          return `<div class="preview-viewer-block invalid">Invalid viewer block</div>`;
        }
        return `<div class="preview-viewer-block"><a href="/view?state=${encoded}" target="_blank" rel="noopener noreferrer">Open embedded viewer block</a></div>`;
      });
  }

  private tryEncodeViewerBlock(rawJson: string): string | null {
    try {
      const parsed = JSON.parse(rawJson.trim()) as { ra?: unknown; dec?: unknown; fov?: unknown; survey?: unknown };
      return this.encodeState({
        ra: Number(parsed.ra),
        dec: Number(parsed.dec),
        fov: Number(parsed.fov),
        survey: String(parsed.survey || 'VLASS'),
      });
    } catch {
      return null;
    }
  }
  private encodeState(state: { ra: number; dec: number; fov: number; survey: string }): string {
    return btoa(JSON.stringify(state))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }
}
