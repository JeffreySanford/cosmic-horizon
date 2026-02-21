import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AppHeaderControlService {
  private expandedSubject = new Subject<boolean>();
  readonly expanded$ = this.expandedSubject.asObservable();

  setExpanded(expanded: boolean): void {
    this.expandedSubject.next(expanded);
  }

  expand(): void {
    this.setExpanded(true);
  }

  collapse(): void {
    this.setExpanded(false);
  }

  toggle(current: boolean): void {
    this.setExpanded(!current);
  }
}
