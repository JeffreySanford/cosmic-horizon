import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MaterialModule } from '../../shared/material/material.module';
import { DocsComponent } from './docs.component';

const routes: Routes = [
  {
    path: '',
    component: DocsComponent,
    data: {
      header: {
        title: 'Documentation',
        icon: 'description',
        iconTone: 'slate',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Docs', icon: 'description' },
        ],
      },
    },
  },
  {
    path: ':docId',
    component: DocsComponent,
    data: {
      header: {
        title: 'Document',
        icon: 'article',
        iconTone: 'slate',
        breadcrumbs: [
          { label: 'Home', route: '/landing', icon: 'home' },
          { label: 'Docs', route: '/docs', icon: 'description' },
          { label: 'Document', icon: 'article' },
        ],
        parentLink: {
          label: 'Back to Docs',
          route: '/docs',
          icon: 'arrow_back',
        },
      },
    },
  },
];

@NgModule({
  declarations: [DocsComponent],
  imports: [CommonModule, MaterialModule, RouterModule.forChild(routes)],
})
export class DocsModule {}
