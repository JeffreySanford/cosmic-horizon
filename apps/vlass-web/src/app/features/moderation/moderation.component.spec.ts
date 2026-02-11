import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ModerationComponent } from './moderation.component';
import { CommentsApiService } from '../posts/comments-api.service';

describe('ModerationComponent', () => {
  let component: ModerationComponent;
  let fixture: ComponentFixture<ModerationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ModerationComponent],
      imports: [
        CommonModule,
        MatIconModule,
        MatCardModule,
        MatTableModule,
        MatChipsModule,
        MatProgressSpinnerModule,
        MatButtonModule,
        NoopAnimationsModule
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CommentsApiService
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModerationComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
