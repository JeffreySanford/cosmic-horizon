import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { of } from 'rxjs';
import { AlertsComponent } from './alerts.component';
import { AlertsService } from './alerts.service';

describe('AlertsComponent', () => {
  let fixture: ComponentFixture<AlertsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AlertsComponent],
      imports: [CommonModule, MatCardModule, MatListModule],
      providers: [
        {
          provide: AlertsService,
          useValue: { alerts$: of(['a', 'b']) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AlertsComponent);
    fixture.detectChanges();
  });

  it('renders alert items from service', () => {
    const items = fixture.nativeElement.querySelectorAll('mat-list-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent.trim()).toBe('a');
  });

  it('shows placeholder when there are no alerts', async () => {
    // rebuild the testing module with an empty alerts stream
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      declarations: [AlertsComponent],
      imports: [CommonModule, MatCardModule, MatListModule],
      providers: [
        {
          provide: AlertsService,
          useValue: { alerts$: of([]) },
        },
      ],
    }).compileComponents();
    const f2 = TestBed.createComponent(AlertsComponent);
    f2.detectChanges();
    const paragraph = f2.nativeElement.querySelector('p');
    expect(paragraph.textContent.trim()).toBe('No alerts to display yet.');
  });
});
