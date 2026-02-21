import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { MaterialModule } from '../../shared/material/material.module';
import { LandingComponent } from './landing.component';

const landingRoutes: Routes = [
  {
    path: '',
    component: LandingComponent,
    data: {
      header: {
        title: 'Cosmic Horizons',
        icon: 'rocket_launch',
        iconTone: 'aurora',
        subtitle: 'Docking surface for autonomous CosmicAI agents',
        breadcrumbs: [{ label: 'Home', route: '/landing', icon: 'home' }],
      },
    },
  },
];

@NgModule({
  declarations: [LandingComponent],
  imports: [
    CommonModule,
    MaterialModule,
    RouterModule.forChild(landingRoutes),
  ],
})
export class LandingModule {}
