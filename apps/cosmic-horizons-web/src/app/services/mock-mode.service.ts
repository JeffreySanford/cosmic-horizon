import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MockModeService {
  /** true when mock mode is enabled */
  private _mock$ = new BehaviorSubject<boolean>(false);
  readonly mock$ = this._mock$.asObservable();

  enable(): void {
    this._mock$.next(true);
  }
  disable(): void {
    this._mock$.next(false);
  }
  toggle(): void {
    this._mock$.next(!this._mock$.value);
  }
  get isMock(): boolean {
    return this._mock$.value;
  }
}
