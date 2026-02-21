import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MaterialModule } from '../../shared/material/material.module';
import { AlertsComponent } from './alerts.component';

const alertsRoutes: Routes = [
  {
    path: '',
    component: AlertsComponent,
  },
];

@NgModule({
  declarations: [AlertsComponent],
  imports: [CommonModule, MaterialModule, RouterModule.forChild(alertsRoutes)],
})
export class AlertsModule {}
