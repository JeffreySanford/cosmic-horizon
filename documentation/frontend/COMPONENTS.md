# Frontend Components Catalog

**Date:** 2026-02-07  
**Status:** MVP - Production Ready  
**Scope:** All major Angular components in vlass-web app

---

## Table of Contents

1. [Component Hierarchy](#component-hierarchy)
2. [Feature Components (Routed)](#feature-components-routed)
3. [Shared Components](#shared-components)
4. [Service Singletons](#service-singletons)
5. [Component Interaction Patterns](#component-interaction-patterns)
6. [Testing Guidelines](#testing-guidelines)

---

## Component Hierarchy

```text
AppComponent (root)
├── Router Outlet
│
├── [LandingComponent]
│   └── Project discovery grid
│
├── [AuthModule]
│   ├── LoginComponent
│   ├── RegisterComponent
│   └── VerifyMfaComponent
│
├── [ViewerComponent] ⭐ (Pillar 2)
│   ├── Aladin canvas container
│   ├── Overlay controls (Grid, Labels, P/DSS2/color toggles)
│   ├── Control Deck (form + actions)
│   ├── Annotations panel
│   ├── Cutout telemetry panel
│   └── Permalink metadata panel
│
├── [PostsModule] ⭐ (Pillar 3)
│   ├── PostsListComponent (feed)
│   ├── PostEditorComponent (markdown + viewer blocks)
│   └── PostDetailComponent (published post)
│
└── [AdminModule]
    ├── AdminLogsDashboardComponent
    │   ├── LogCountTilesComponent
    │   └── LogTableComponent (Material DataTable)
    └── ModerationComponent
```

---

## Feature Components (Routed)

These are the major components loaded via the router.

### LandingComponent

**Path:** `features/landing/landing.component.ts`  
**Route:** `/landing` (default)  
**Purpose:** Project discovery and navigation hub

#### Landing Inputs

- None (data fetched from API)

#### Landing Outputs

- None (navigation via router)

#### Services Used

- `AuthService` (check login status)
- `ApiService` (fetch projects)

#### Landing Key Methods

```typescript
ngOnInit(): void {
  // Load public projects
  this.projects$ = this.api.getPublicProjects();
  
  // Track user auth state
  this.isAuthenticated$ = this.authService.isAuthenticated$;
  this.currentUser$ = this.authService.currentUser$;
}

navigateToViewer(): void {
  this.router.navigate(['/view']);
}

navigateToEditor(): void {
  this.router.navigate(['/posts/new']); // Guard redirects if not authenticated
}
```

#### Template Sections

- Hero banner (title + intro)
- Search/filter projects
- Project grid (cards)
- Call-to-action buttons (Explore Viewer, New Post)
- Footer with quick links

---

### ViewerComponent ⭐

**Path:** `features/viewer/viewer.component.ts`  
**Route:** `/view`, `/view/:shortId`  
**Purpose:** Interactive astronomical sky viewer (Aladin Mode A)  
**Complexity:** COMPLEX (1000+ lines)

#### Viewer Inputs

- Route params: `shortId` (optional) for loading persisted state

#### Viewer Outputs

- Events logged to backend via LoggerService
- State persisted to localStorage + database

#### Viewer Services Used

- `ViewerApiService` (state + cutout API)
- `ActivatedRoute` (route params)
- `StorageService` (localStorage)
- `LoggerService` (event logging)
- `FormBuilder` (reactive state form)

#### Viewer Key Properties

```typescript
// State
stateForm: FormGroup; // RA, Dec, FoV, Survey
gridOverlayEnabled: boolean = false;
labelsOverlayEnabled: boolean = true;
pdssColorEnabled: boolean = false;

// Canvas
@ViewChild('aladinHost') aladinHost: ElementRef<HTMLElement>;
private aladinView: AladinView | null = null;

// Interactions
labels: ViewerLabelModel[] = [];
catalogLabels: NearbyCatalogLabelModel[] = [];
centerCatalogLabel: NearbyCatalogLabelModel | null = null;

// Async states
loadingPermalink: boolean = false;
savingSnapshot: boolean = false;
cutoutTelemetry: CutoutTelemetryModel | null = null;
```

#### Viewer Key Methods

| Method | Purpose |
| --- | --- |
| `toggleGridOverlay(enabled)` | Toggle coordinate grid |
| `toggleLabelsOverlay(enabled)` | Toggle catalog labels |
| `togglePdssColor(enabled)` | Toggle P/DSS2/color survey |
| `applyStateToUrl()` | Encode state + update URL |
| `downloadScienceData()` | Download FITS cutout |
| `createPermalink()` | Generate + save short ID |
| `saveSnapshot()` | Export PNG screenshot |
| `addCenterLabel()` | Manual label placement |
| `addCenterCatalogLabelAsAnnotation()` | Annotate catalog object |

#### Viewer Lifecycle

1. **ngOnInit:** Parse route params → load state from DB/URL
2. **ngAfterViewInit:** Initialize Aladin on canvas
3. **Form valueChanges subscription:** Sync form → Aladin in real-time
4. **Nearby lookup scheduler:** Query catalogs when panning/zooming
5. **onDestroy:** Clear timers, save labels to localStorage

#### Viewer Template Structure

- `<mat-toolbar>` — Header (title, back button)
- `<div class="aladin-stage">` — Sky canvas container
- `<div class="viewer-overlay-controls">` — Toggle switches (Grid, Labels, P/DSS)
- `<mat-card class="viewer-state-card">` — Right panel with Control Deck
  - State form fields (RA, Dec, FoV, Survey)
  - Action buttons (Update URL, Download FITS, Create Permalink, Save PNG)
  - Label management section
  - Annotations details panel
  - Cutout telemetry
  - Encoded state display

---

### PostEditorComponent

**Path:** `features/posts/post-editor.component.ts`  
**Route:** `/posts/new` (create) or `/posts/:id/edit` (edit)  
**Purpose:** Markdown editor with embedded viewer block parsing

#### Editor Inputs

- Route param: `id` (optional, for edit mode)

#### Editor Outputs

- POST `/api/posts` (create)
- PUT `/api/posts/:id` (update)

#### Editor Services Used

- `PostsApiService` (CRUD)
- `FormBuilder` (title + content form)
- `StorageService` (draft auto-save)
- `Router` (navigation)

#### Editor Key Properties

```typescript
editForm: FormGroup; // title, content
initialContent: string = '';
isDirty: boolean = false;
isSaving: boolean = false;
draftKey = 'post-draft'; // localStorage key
```

#### Editor Key Methods

```typescript
// Parse viewer blocks from markdown
private parseViewerBlocks(markdown: string): ViewerBlockReference[] {
  const regex = /```viewer\s*\n([\s\S]*?)\n```/g;
  const blocks: ViewerBlockReference[] = [];
  let match;
  
  while ((match = regex.exec(markdown)) !== null) {
    try {
      const config = JSON.parse(match[1]);
      blocks.push({
        ra: config.center?.raDeg,
        dec: config.center?.decDeg,
        fov: config.fov,
        survey: config.survey,
      });
    } catch (e) {
      // Invalid JSON in viewer block
      this.logParseError(e);
    }
  }
  
  return blocks;
}

// Auto-save to localStorage
private autoSaveDraft(): void {
  if (this.editForm.valid) {
    const draft = {
      title: this.editForm.value.title,
      content: this.editForm.value.content,
      savedAt: Date.now(),
    };
    this.storageService.setDraft(this.draftKey, draft);
  }
}

// Save (create/update)
async saveDraft(): Promise<void> {
  this.isSaving = true;
  try {
    const dto = { 
      title: this.editForm.value.title,
      content: this.editForm.value.content 
    };
    
    if (this.editMode && this.postId) {
      await this.postsApi.updatePost(this.postId, dto).toPromise();
    } else {
      const response = await this.postsApi.createPost(dto).toPromise();
      this.postId = response.id;
    }
    
    this.router.navigate(['/posts', this.postId]);
  } finally {
    this.isSaving = false;
  }
}
```

#### Editor Lifecycle

1. **ngOnInit:** Load draft from localStorage if new post; load from DB if editing
2. **Form valueChanges:** Auto-save to localStorage every 5s
3. **Parse viewer blocks:** Extract coordinates for preview (future enhancement)
4. **onDestroy:** Clear form (reset isDirty flag)

#### Editor Template

- Title input field
- Markdown content textarea
- Preview pane (collapsible, shows parsed blocks)
- Auto-save indicator
- Publish/Save/Discard buttons

---

### PostDetailComponent

**Path:** `features/posts/post-detail.component.ts`  
**Route:** `/posts/:id`  
**Purpose:** Display published/draft post with edit/publish controls

#### Detail Inputs

- Route param: `id` (post ID)

#### Detail Outputs

- POST `/api/posts/:id/publish` (publish)
- PUT `/api/posts/:id` (update)
- DELETE `/api/posts/:id` (delete)

#### Detail Services Used

- `PostsApiService`
- `ActivatedRoute`
- `Router`

#### Detail Key Properties

```typescript
post: PostModel | null = null;
revisions: RevisionModel[] = []; // Revision history
currentRevisionId: string | null = null;
isOwner: boolean = false;
isPublished: boolean = false;
isLoading: boolean = true;
```

#### Detail Key Methods

```typescript
ngOnInit(): void {
  const postId = this.route.snapshot.paramMap.get('id');
  this.postsApi.getPost(postId).subscribe({
    next: (post) => {
      this.post = post;
      this.isOwner = post.user_id === this.authService.currentUserId;
      this.isPublished = post.status === 'PUBLISHED';
      this.loadRevisions(postId);
      this.isLoading = false;
    },
    error: () => {
      this.router.navigate(['/landing']); // 404 → landing
    },
  });
}

publish(): void {
  const postId = this.post?.id;
  if (!postId) return;
  
  this.postsApi.publishPost(postId)
    .subscribe({
      next: (updatedPost) => {
        this.post = updatedPost;
        this.isPublished = true;
        this.loadRevisions(postId);
      },
    });
}

editPost(): void {
  this.router.navigate(['/posts', this.post?.id, 'edit']);
}

deletePost(): void {
  if (confirm('Permanently delete this post?')) {
    this.postsApi.deletePost(this.post!.id)
      .subscribe(() => {
        this.router.navigate(['/posts']);
      });
  }
}

private loadRevisions(postId: string): void {
  this.postsApi.getRevisions(postId)
    .subscribe(revisions => {
      this.revisions = revisions.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
}
```

#### Detail Lifecycle

1. **ngOnInit:** Load post + revisions
2. **Display:** Show title, author, content, revision history
3. **Auth check:** Show edit/delete buttons only if owner

4. **Revision view:** Click revision to show specific version

#### Detail Template

- Post card header (title, author, created/published dates)
- Post content (rendered markdown)
- Revision history sidebar (list of revisions with dates)
- Action buttons (Edit, Publish/Unpublish, Delete) if owner
- Comments section placeholder (future)

---

### PostsListComponent

**Path:** `features/posts/posts-list.component.ts`  
**Route:** `/posts`  
**Purpose:** Feed of published community posts

#### List Inputs

- Query params: `page`, `author`, `search`

#### List Outputs

- Navigation to post detail on row click

#### List Services Used

- `PostsApiService`
- `ActivatedRoute` (query params)
- `Router`

#### List Key Properties

```typescript
posts: PostModel[] = [];
currentPage: number = 1;
pageSize: number = 20;
totalCount: number = 0;
isLoading: boolean = false;

// Filters
searchTerm: string = '';
selectedAuthor: string | null = null;
```

#### List Key Methods

```typescript
ngOnInit(): void {
  this.activatedRoute.queryParams.subscribe(params => {
    this.currentPage = parseInt(params['page'] || '1', 10);
    this.searchTerm = params['search'] || '';
    this.selectedAuthor = params['author'] || null;
    this.loadPosts();
  });
}

loadPosts(): void {
  this.isLoading = true;
  this.postsApi.getPosts({
    page: this.currentPage,
    limit: this.pageSize,
    search: this.searchTerm,
    author_id: this.selectedAuthor,
  }).subscribe({
    next: (response) => {
      this.posts = response.data;
      this.totalCount = response.pagination.total;
      this.isLoading = false;
    },
  });
}

onPageChange(newPage: number): void {
  this.router.navigate([], {
    relativeTo: this.activatedRoute,
    queryParams: { page: newPage },
    queryParamsHandling: 'merge',
  });
}

viewPost(postId: string): void {
  this.router.navigate(['/posts', postId]);
}
```

#### List Template

- Search + filter form
- Loading spinner (if isLoading)
- Post grid/list view
  - Post card per row (title, author, excerpt, created date)
  - Click to navigate to detail
- Pagination controls (prev/next, page number input)

---

### AdminLogsDashboardComponent

**Path:** `features/admin/logs/admin-logs-dashboard.component.ts`  
**Route:** `/admin/logs`  
**Requires:** RBAC admin role  
**Purpose:** System logs viewer with filters + full-text search

#### Admin Services Used

- `AdminLogsApiService`
- `FormBuilder` (filter form)

#### Key Properties

```typescript
logs$: Observable<LogModel[]>;
loading$: Observable<boolean>;
logCounts: LogCountSummary = { all: 0, http: 0, error: 0, info: 0, ... };
selectedFilter$: BehaviorSubject<string> = new BehaviorSubject('all');

filterForm: FormGroup; // search, type, severity, user, date range
pagination$: Observable<PaginationModel>;
```

#### Admin Key Methods

```typescript
ngOnInit(): void {
  // Init filter form
  this.filterForm = this.fb.group({
    search: [''],
    type: [''],
    severity: [''],
    user_id: [''],
    from: [''],
    to: [''],
  });
  
  // Load logs on filter change
  this.filterForm.valueChanges
    .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
    .subscribe(() => this.applyFilters());
  
  // Load initial summary (counts)
  this.loadSummary();
}

loadSummary(): void {
  this.adminApi.getLogsSummary()
    .subscribe(summary => {
      this.logCounts = summary;
    });
}

onFilterChange(filterType: string): void {
  this.selectedFilter$.next(filterType);
  if (filterType === 'all') {
    this.filterForm.patchValue({ severity: '', type: '' });
  } else if (['error', 'warning', 'info'].includes(filterType)) {
    this.filterForm.patchValue({ severity: filterType });
  } else {
    this.filterForm.patchValue({ type: filterType });
  }
  this.applyFilters();
}

applyFilters(): void {
  const filters = this.filterForm.value;
  this.logs$ = this.adminApi.getLogs({
    page: 1,
    limit: 50,
    ...filters,
  }).pipe(
    map(response => response.data),
    shareReplay(1),
  );
}
```

#### See Also

[LOGGING-SYSTEM-DESIGN.md](../LOGGING-SYSTEM-DESIGN.md) for complete logging architecture.

---

## Shared Components

These are reusable components used across features.

### HeaderComponent

**Path:** `shared/components/header.component.ts`  
**Purpose:** Top navigation bar

#### Header Inputs

- `title: string` (page title)
- `showBackButton: boolean` (optional)

#### Header Outputs

- `backClicked: EventEmitter<void>`

#### Template

- Logo + brand
- Current page title
- User menu dropdown (profile, logout) if authenticated
- Back button (if showBackButton true)

---

### LoadingSpinnerComponent

**Path:** `shared/components/loading-spinner.component.ts`  
**Purpose:** Reusable loading indicator

#### Spinner Inputs

- `isLoading: boolean`
- `message: string` (optional)

#### Spinner Template

- Material spinner
- Loading text message

---

### ConfirmDialogComponent

**Path:** `shared/components/confirm-dialog.component.ts`  
**Purpose:** Modal confirmation dialog

#### Usage

```typescript
const result = this.dialog.open(ConfirmDialogComponent, {
  data: {
    title: 'Delete Post?',
    message: 'This action cannot be undone.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
  }
});

result.afterClosed().subscribe(confirmed => {
  if (confirmed) {
    this.deletePost();
  }
});
```

---

## Service Singletons

These are global services provided at root level.

### AuthService

**Path:** `services/auth.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser$ = new BehaviorSubject<User | null>(null);
  isAuthenticated$ = this.currentUser$.pipe(map(u => !!u));
  
  login(email: string, password: string): Observable<AuthResponse>
  register(email: string, password: string): Observable<AuthResponse>
  verifyMfa(code: string): Observable<AuthResponse>
  logout(): void
  refreshToken(): Observable<string>
}
```

---

### ViewerApiService

**Path:** `features/viewer/viewer-api.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class ViewerApiService {
  getState(shortId: string): Observable<ViewerStateResponse>
  createState(state: ViewerStateModel): Observable<ViewerStateResponse>
  getNearby(state: ViewerStateModel, radius: number): Observable<NearbyResponse>
  scienceDataUrl(state: ViewerStateModel, detail: string): string
  downloadCutout(state: ViewerStateModel): Observable<Blob>
}
```

---

### PostsApiService

**Path:** `features/posts/posts-api.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class PostsApiService {
  createPost(dto: CreatePostDto): Observable<PostModel>
  getPost(id: string): Observable<PostModel>
  updatePost(id: string, dto: UpdatePostDto): Observable<PostModel>
  publishPost(id: string): Observable<PostModel>
  deletePost(id: string): Observable<void>
  getPublishedPosts(options: QueryOptions): Observable<PaginatedResponse<PostModel>>
  getRevisions(postId: string): Observable<RevisionModel[]>
}
```

---

### AdminLogsApiService

**Path:** `features/admin/logs/admin-logs-api.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class AdminLogsApiService {
  getLogs(filters: LogFilterOptions): Observable<PaginatedResponse<LogModel>>
  getLogsSummary(fromDate?: Date, toDate?: Date): Observable<LogCountSummary>
  deleteOldLogs(retentionDays: number): Observable<{ deleted_count: number }>
}
```

---

## Component Interaction Patterns

### Parent → Child: @Input

```typescript
// Parent
<app-post-card [post]="post" [isOwner]="isOwner"></app-post-card>

// Child
@Input() post: PostModel;
@Input() isOwner: boolean = false;
```

### Child → Parent: @Output + EventEmitter

```typescript
// Parent
<app-post-actions [postId]="postId" 
                   (published)="onPublished($event)"
                   (deleted)="onDeleted($event)">
</app-post-actions>

onPublished(post: PostModel): void {
  this.post = post;
}

// Child
@Output() published = new EventEmitter<PostModel>();

publish(): void {
  this.api.publishPost(this.postId).subscribe(result => {
    this.published.emit(result);
  });
}
```

### Async Data: Observable + async Pipe

```typescript
// Component
posts$ = this.postsApi.getPublishedPosts();

// Template
@for (post of posts$ | async; track post.id) {
  <app-post-card [post]="post"></app-post-card>
}
```

---

## Testing Guidelines

### Component Testing Template

```typescript
describe('MyComponent', () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;
  let mockService: jasmine.SpyObj<MyService>;

  beforeEach(async () => {
    mockService = jasmine.createSpyObj('MyService', ['getData']);
    
    await TestBed.configureTestingModule({
      imports: [MyComponent],
      providers: [
        { provide: MyService, useValue: mockService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load data on init', () => {
    mockService.getData.and.returnValue(of(mockData));
    component.ngOnInit();
    expect(mockService.getData).toHaveBeenCalled();
  });
});
```

---

**Last Updated:** 2026-02-07  
**Maintained By:** VLASS Portal Frontend Team
