import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MaterialModule } from '../../shared/material/material.module';
import { PostDetailComponent } from './post-detail.component';
import { PostEditorComponent } from './post-editor.component';
import { PostsListComponent } from './posts-list.component';
import { CommentItemComponent } from './comment-item/comment-item.component';

const postsRoutes: Routes = [
  {
    path: '',
    component: PostsListComponent,
    data: {
      header: {
        title: 'Community Posts',
        icon: 'forum',
        iconTone: 'violet',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Posts', icon: 'forum' },
        ],
      },
    },
  },
  {
    path: 'new',
    component: PostEditorComponent,
    data: {
      header: {
        title: 'New Post',
        icon: 'edit_square',
        iconTone: 'violet',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Posts', route: '/posts', icon: 'forum' },
          { label: 'New Post', icon: 'edit_square' },
        ],
        parentLink: {
          label: 'Back to Posts',
          route: '/posts',
          icon: 'arrow_back',
        },
      },
    },
  },
  {
    path: ':id',
    component: PostDetailComponent,
    data: {
      header: {
        title: 'Post Detail',
        icon: 'article',
        iconTone: 'violet',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Posts', route: '/posts', icon: 'forum' },
          { label: 'Post Detail', icon: 'article' },
        ],
        parentLink: {
          label: 'Back to Posts',
          route: '/posts',
          icon: 'arrow_back',
        },
      },
    },
  },
];

@NgModule({
  declarations: [
    PostsListComponent,
    PostEditorComponent,
    PostDetailComponent,
    CommentItemComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    RouterModule.forChild(postsRoutes),
  ],
})
export class PostsModule {}
