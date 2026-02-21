import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MockModeService {
  private readonly storageKey = 'mock_mode_enabled';
  /** true when mock mode is enabled */
  private _mock$ = new BehaviorSubject<boolean>(this.initialMockState());
  readonly mock$ = this._mock$.asObservable();

  enable(): void {
    this.setMockState(true);
  }
  disable(): void {
    this.setMockState(false);
  }
  toggle(): void {
    this.setMockState(!this._mock$.value);
  }
  get isMock(): boolean {
    return this._mock$.value;
  }

  private setMockState(enabled: boolean): void {
    this._mock$.next(enabled);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(this.storageKey, String(enabled));
    }
  }

  private initialMockState(): boolean {
    if (typeof window === 'undefined') {
      return true;
    }

    const raw = window.sessionStorage.getItem(this.storageKey);
    if (raw === null) {
      return true;
    }

    return raw !== 'false';
  }
}
