import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-gdpr-location-dialog',
  standalone: false,
  templateUrl: './gdpr-location-dialog.component.html',
  styleUrls: ['./gdpr-location-dialog.component.scss'],
})
export class GdprLocationDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<GdprLocationDialogComponent>,
  );

  userConsent = false;
  locationData = {
    latitude: null as number | null,
    longitude: null as number | null,
  };
  geolocationError = '';

  requestLocation(): void {
    if (!this.userConsent) {
      return;
    }

    this.geolocationError = '';

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          this.geolocationError = '';
        },
        () => {
          this.geolocationError =
            'Location access was blocked. Select Deny to continue without coordinates.';
        },
      );
    } else {
      this.geolocationError =
        'Geolocation is not available in this browser. Select Deny to continue.';
    }
  }

  confirmLocation(): void {
    if (
      this.locationData.latitude !== null &&
      this.locationData.longitude !== null
    ) {
      this.dialogRef.close(this.locationData);
    }
  }

  deny(): void {
    this.dialogRef.close(null);
  }
}
