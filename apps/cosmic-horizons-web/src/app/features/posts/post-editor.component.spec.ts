import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostsApiService } from './posts-api.service';
import { PostEditorComponent } from './post-editor.component';

describe('PostEditorComponent', () => {
  let fixture: ComponentFixture<PostEditorComponent>;
  let component: PostEditorComponent;
  let postsApi: { createPost: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    postsApi = {
      createPost: vi.fn().mockReturnValue(
        of({
          id: 'post-1',
          user_id: 'user-1',
          title: 'My draft',
          content: 'markdown',
          status: 'draft',
          published_at: null,
          created_at: '2026-02-07T00:00:00.000Z',
          updated_at: '2026-02-07T00:00:00.000Z',
        }),
      ),
    };

    await TestBed.configureTestingModule({
      declarations: [PostEditorComponent],
      imports: [ReactiveFormsModule, RouterTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: PostsApiService,
          useValue: postsApi,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PostEditorComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('parses markdown viewer blocks into encoded state links', () => {
    component.editorForm.patchValue({
      title: 'Draft',
      content:
        '```viewer\n{"ra":187.25,"dec":2.05,"fov":1.5,"survey":"VLASS"}\n```',
    });

    component.parseViewerBlocks();
    expect(component.viewerBlocks.length).toBe(1);
    expect(component.viewerBlocks[0].encodedState.length).toBeGreaterThan(0);
  });

  it('creates draft and navigates to post detail', () => {
    component.editorForm.patchValue({
      title: 'My draft',
      content: 'This is markdown content with enough text.',
    });

    component.saveDraft();
    expect(postsApi.createPost).toHaveBeenCalledWith({
      title: 'My draft',
      content: 'This is markdown content with enough text.',
    });
    expect(router.navigate).toHaveBeenCalledWith(['/posts', 'post-1']);
  });

  it('does not save draft for invalid form', () => {
    component.editorForm.patchValue({
      title: 'No',
      content: 'short',
    });

    component.saveDraft();
    expect(postsApi.createPost).not.toHaveBeenCalled();
    expect(component.statusMessage).toBe(
      'Please enter a valid title and content.',
    );
  });

  it('shows API error message when save fails', () => {
    postsApi.createPost.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            error: { message: 'Save failed.' },
            status: 400,
          }),
      ),
    );
    component.editorForm.patchValue({
      title: 'My draft',
      content: 'This is markdown content with enough text.',
    });

    component.saveDraft();
    expect(component.statusMessage).toBe('Save failed.');
  });

  it('skips invalid viewer blocks while parsing', () => {
    component.editorForm.patchValue({
      title: 'Draft',
      content: '```viewer\n{"ra":187.25,invalid}\n```',
    });

    component.parseViewerBlocks();
    expect(component.viewerBlocks.length).toBe(0);
    expect(component.statusMessage).toBe('No valid viewer blocks found.');
  });
});
