import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-permission-modal',
  standalone: false,
  templateUrl: './permission-modal.component.html',
  styleUrls: ['./permission-modal.component.scss'],
})
export class PermissionModalComponent {
  private readonly dialogRef = inject(MatDialogRef<PermissionModalComponent>);

  onAllow(): void {
    this.dialogRef.close(true);
  }

  onDeny(): void {
    this.dialogRef.close(false);
  }
}
