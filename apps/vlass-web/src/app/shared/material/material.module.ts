import { NgModule } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';

const MATERIAL_MODULES = [
  MatToolbarModule,
  MatButtonModule,
  MatFormFieldModule,
  MatInputModule,
  MatCardModule,
  MatMenuModule,
  MatIconModule,
  MatProgressSpinnerModule,
  MatSnackBarModule,
  MatDividerModule,
  MatListModule,
  MatSlideToggleModule,
  MatTableModule,
  MatSortModule,
];

@NgModule({
  imports: MATERIAL_MODULES,
  exports: MATERIAL_MODULES,
})
export class MaterialModule {}
