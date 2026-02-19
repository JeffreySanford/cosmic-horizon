import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MaterialModule } from '../../shared/material/material.module';
import { EphemerisComponent } from './ephemeris.component';

const ephemerisRoutes: Routes = [
  {
    path: '',
    component: EphemerisComponent,
  },
];

@NgModule({
  declarations: [EphemerisComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    RouterModule.forChild(ephemerisRoutes),
  ],
})
export class EphemerisModule {}
