import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CommunityFeedViewComponent } from './community-feed.component';
import { CommunityModule } from './community.module';

describe('CommunityFeedComponent (prototype)', () => {
  let fixture: ComponentFixture<CommunityFeedViewComponent>;
  let component: CommunityFeedViewComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityModule, HttpClientTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunityFeedViewComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('loads feed on init', () => {
    const mockFeed = [
      { id: '1', title: 'a', createdAt: new Date().toISOString() },
    ];

    fixture.detectChanges();

    const req = httpMock.expectOne('http://localhost:3000/api/community/feed');
    expect(req.request.method).toBe('GET');
    req.flush(mockFeed);

    expect(component.feed.length).toBe(1);
  });

  it('posts a new discovery and reloads', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('http://localhost:3000/api/community/feed');
    req.flush([]);

    component.newTitle = 'hello';
    component.newBody = 'world';

    component.create();

    const postReq = httpMock.expectOne('http://localhost:3000/api/community/posts');
    expect(postReq.request.method).toBe('POST');
    postReq.flush({ id: 'abc', title: 'hello', createdAt: new Date().toISOString() });

    const reloadReq = httpMock.expectOne('http://localhost:3000/api/community/feed');
    reloadReq.flush([{ id: 'abc', title: 'hello', createdAt: new Date().toISOString() }]);

    expect(component.feed.length).toBe(1);
  });
});
