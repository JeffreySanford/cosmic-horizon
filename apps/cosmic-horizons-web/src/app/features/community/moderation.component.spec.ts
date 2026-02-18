import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunityApiService } from './community-api.service';
import { ModerationComponent } from './moderation.component';

describe('ModerationComponent', () => {
  let fixture: ComponentFixture<ModerationComponent>;
  let component: ModerationComponent;
  let apiMock: Partial<CommunityApiService>;

  beforeEach(async () => {
    apiMock = {
      getPending: vi.fn().mockReturnValue(of([])),
      approvePost: vi.fn().mockReturnValue(of({} as any)),
      hidePost: vi.fn().mockReturnValue(of({} as any)),
    } as any;

    await TestBed.configureTestingModule({
      imports: [
        /* material */
        (await import('@angular/material/card')).MatCardModule,
        (await import('@angular/material/list')).MatListModule,
        (await import('@angular/material/button')).MatButtonModule,
      ],
      declarations: [ModerationComponent],
      providers: [{ provide: CommunityApiService, useValue: apiMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(ModerationComponent);
    component = fixture.componentInstance;
  });

  it('loads pending items on init', () => {
    (apiMock.getPending as any).mockReturnValueOnce(of([{ id: '1', title: 'x', createdAt: new Date().toISOString() }] as any));
    fixture.detectChanges();
    expect(apiMock.getPending).toHaveBeenCalled();
  });

  it('calls approvePost when approve invoked', () => {
    const item = { id: '1', title: 'x', createdAt: new Date().toISOString() } as any;
    (apiMock.getPending as any).mockReturnValueOnce(of([item]));
    fixture.detectChanges();

    component.approve(item);
    expect(apiMock.approvePost).toHaveBeenCalledWith('1');
  });
});