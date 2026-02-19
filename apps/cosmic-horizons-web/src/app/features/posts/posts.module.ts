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
  },
  {
    path: 'new',
    component: PostEditorComponent,
  },
  {
    path: ':id',
    component: PostDetailComponent,
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
