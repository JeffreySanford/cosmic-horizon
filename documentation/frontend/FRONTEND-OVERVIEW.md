# Frontend Architecture Overview

**Date:** 2026-02-07
**Status:** MVP - Production Ready
**Framework:** Angular 18 + Angular Material 3
**Type System:** TypeScript 5.x
**Test Framework:** Vitest (unit), Jasmine (component specs), Playwright (E2E)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)

2. [Project Structure](#project-structure)

3. [Technology Stack](#technology-stack)

4. [Key Components](#key-components)

5. [State Management](#state-management)

6. [HTTP & Interceptors](#http--interceptors)

7. [Routing Strategy](#routing-strategy)

8. [Build & Deployment](#build--deployment)

9. [Testing Strategy](#testing-strategy)

10. [Performance Considerations](#performance-considerations)

---

## Architecture Overview

The VLASS Portal frontend follows a **Three-Pillar MVP** structure:

```text
┌────────────────────────────────────────────────────────┐
│         VLASS Portal Frontend (Angular 18)             │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Pillar 1: Landing + Auth                            │

│  ├─ Landing page (project discovery)                 │
│  ├─ Authentication flow (email + MFA)                │

│  └─ User dashboard (profile, settings)               │
│                                                        │
│  Pillar 2: Interactive Viewer (Aladin Mode A)        │
│  ├─ Sky viewer with HiPS tiles                       │
│  ├─ Coordinate + survey controls                     │

│  ├─ Annotations + labels                             │

│  ├─ FITS cutout download                             │
│  ├─ PNG snapshot saves                               │
│  ├─ Shareable permalinks + URL state encoding        │

│  └─ Real-time nearby catalog lookups                 │
│                                                        │
│  Pillar 3: Community Posts + Revisions               │

│  ├─ Markdown editor with viewer block parsing        │
│  ├─ Post detail view with publish controls           │
│  ├─ Published posts feed                             │
│  ├─ Revision history + diff viewing                  │

│  └─ Comment annotations (future)                     │
│                                                        │
│  Admin Features                                       │
│  ├─ System logs dashboard (filtered + searchable)    │

│  ├─ Moderation controls (hide/lock posts)            │
│  └─ Configuration management                         │
│                                                        │
└────────────────────────────────────────────────────────┘
         │                                │
         └───────────┬────────────────────┘
                     │
              HTTP + WebSocket

                     │
         ┌───────────▼──────────┐
         │   NestJS Backend     │
         │   (vlass-api)        │
         └──────────────────────┘

```

---

## Project Structure

The frontend code is organized under `apps/vlass-web/src/app/`:

```text
apps/vlass-web/
├── public/
│   ├── favicon.ico
│   ├── styles.globals.scss
│   └── assets/
│       ├── images/
│       ├── fonts/
│       └── vendor/
├── src/
│   ├── app/
│   │   ├── app.config.ts              # Root application configuration

│   │   ├── app.component.ts           # Root component

│   │   ├── app.routes.ts              # Route configuration

│   │   │
│   │   ├── guards/                    # Route guards

│   │   │   ├── authenticated.guard.ts
│   │   │   ├── admin.guard.ts
│   │   │   └── unsaved-changes.guard.ts
│   │   │
│   │   ├── interceptors/              # HTTP interceptors

│   │   │   ├── logging.interceptor.ts
│   │   │   ├── auth.interceptor.ts
│   │   │   └── error.interceptor.ts
│   │   │
│   │   ├── services/                  # Global services

│   │   │   ├── auth.service.ts        # Authentication & user state

│   │   │   ├── api.service.ts         # Base API communication

│   │   │   ├── logger.service.ts      # Client-side logging

│   │   │   ├── notification.service.ts
│   │   │   └── storage.service.ts     # LocalStorage utilities

│   │   │
│   │   ├── models/                    # TypeScript interfaces

│   │   │   ├── auth.model.ts
│   │   │   ├── post.model.ts
│   │   │   └── viewer.model.ts
│   │   │
│   │   ├── features/                  # Feature modules (routed)

│   │   │   ├── landing/
│   │   │   │   ├── landing.routes.ts
│   │   │   │   ├── landing.component.ts
│   │   │   │   └── landing.component.html
│   │   │   │
│   │   │   ├── auth/
│   │   │   │   ├── login.component.ts
│   │   │   │   ├── register.component.ts
│   │   │   │   ├── verify-mfa.component.ts
│   │   │   │   └── auth.service.ts
│   │   │   │
│   │   │   ├── viewer/                # Sky viewer (Aladin)

│   │   │   │   ├── viewer.routes.ts
│   │   │   │   ├── viewer.component.ts
│   │   │   │   ├── viewer.component.html
│   │   │   │   ├── viewer.component.scss
│   │   │   │   ├── viewer-api.service.ts
│   │   │   │   └── viewer.component.spec.ts
│   │   │   │
│   │   │   ├── posts/                 # Community posts

│   │   │   │   ├── posts.routes.ts
│   │   │   │   ├── posts.module.ts
│   │   │   │   ├── post-editor.component.ts
│   │   │   │   ├── post-detail.component.ts
│   │   │   │   ├── posts-list.component.ts
│   │   │   │   ├── posts-api.service.ts
│   │   │   │   └── [specs]
│   │   │   │
│   │   │   └── admin/                 # Admin dashboard

│   │   │       ├── logs/
│   │   │       │   ├── admin-logs-dashboard.component.ts
│   │   │       │   ├── log-count-tiles.component.ts
│   │   │       │   └── log-table.component.ts
│   │   │       └── moderation/
│   │   │
│   │   └── shared/                    # Reusable components & utilities

│   │       ├── components/
│   │       │   ├── header.component.ts
│   │       │   ├── footer.component.ts
│   │       │   └── loading-spinner.component.ts
│   │       └── utilities/
│   │           ├── validators.ts
│   │           └── formatters.ts
│   │
│   ├── main.ts                        # Bootstrap entry point

│   ├── styles.scss                    # Global styles

│   └── environment.ts                 # Environment configuration

│
├── jest.config.cts                    # Jest test configuration

├── tsconfig.json                      # TypeScript configuration

├── webpack.config.js                  # Webpack build configuration

└── project.json                       # Nx project metadata

```

---

## Technology Stack

### Core Framework

| Technology | Version | Purpose |
| --- | --- | --- |

| **Angular** | 18.x | Component-based UI framework |

| **TypeScript** | 5.x | Type-safe language |

| **RxJS** | 7.x | Reactive programming library |

| **Angular Material** | 3.x | UI component library |

### Build & Task Running

| Tool | Purpose |
| --- | --- |

| **Nx** | Monorepo task orchestration |

| **Webpack** | Module bundling & code splitting |

| **SCSS** | Stylesheet preprocessing |

### Testing

| Framework | Scope | Purpose |
| --- | --- | --- |

| **Vitest** | Unit tests | Fast unit test runner |

| **Jasmine** | Component specs | Component testing framework |

| **Playwright** | E2E tests | End-to-end user flows |

### HTTP & State

| Technology | Purpose |
| --- | --- |

| **HttpClientModule** | HTTP requests |

| **Interceptors** | Request/response lifecycle hooks |

| **RxJS Observables** | Async state management |

| **localStorage** | Client-side persistence |

---

## Key Components

### Landing Component

**Location:** `features/landing/`
**Purpose:** Project discovery, navigation hub
**State:** Displays public projects, login/register prompts
**Routing:** `/landing` (default route)

### Auth Components

**Location:** `features/auth/`
**Components:**

- `LoginComponent` — Email/password entry

- `RegisterComponent` — New user signup

- `VerifyMfaComponent` — Multi-factor authentication verification

**Auth Flow:**

```text
User → Login → Email+Password → Backend validates → JWT issued → Stored in localStorage
           → Redirects to /landing → User authenticated for session

```

### Viewer Component (Pillar 2)

**Location:** `features/viewer/`
**Purpose:** Interactive sky map with Aladin Lite HiPS viewer
**Key Features:**

- **Sky Viewer Canvas:** Loads Aladin Lite CDN bundle

- **Overlay Controls:** Grid, Labels, P/DSS2/color toggles (see [VIEWER-CONTROLS.md](VIEWER-CONTROLS.md))

- **Control Deck:** Coordinate input, survey selector, action buttons

- **State Management:** Full state serializable to URL query params or short ID

- **Permalinks:** Shareable links with encoded viewer state

- **Snapshots & Cutouts:** PNG save + FITS download capabilities

**Critical Lifecycle:**

1. Route to `/view` or `/view/<shortid>`

2. Decode state from URL or route param

3. Initialize Aladin viewer on canvas

4. Populate form fields from state

5. Listen to form changes → update Aladin view in real-time

6. Track HiPS tile prefetch (client-side cache, non-persistent)

### Posts Editor Component

**Location:** `features/posts/post-editor.component.ts`
**Purpose:** Markdown authoring with embedded viewer blocks
**Key Feature:** Parses `\`\`\`viewer {...}\`\`\`` blocks to extract coordinates + survey
**Draft Management:** Auto-saves to localStorage

### Posts Detail Component

**Location:** `features/posts/post-detail.component.ts`
**Purpose:** Display published post with publish/edit controls
**Authorization:** Only post owner can edit/delete
**Actions:** Publish, unpublish, edit, delete

### Posts List Component

**Location:** `features/posts/posts-list.component.ts`
**Purpose:** Feed of published community posts
**Features:** Pagination, filtering by author, search

### Admin Logs Dashboard

**Location:** `features/admin/logs/`
**Purpose:** System log viewing with filters and full-text search
**Features:** Count tiles (all, error, info), Material DataTable, RBAC gated
**See:** [LOGGING-SYSTEM-DESIGN.md](../backend/LOGGING-SYSTEM-DESIGN.md) for comprehensive logging architecture

---

## State Management

The frontend uses **RxJS Observables** as the primary state management pattern:

### AuthService (Global Auth State)

```typescript
// Manages user login, logout, session state
authService.login(email, password)
authService.logout()
authService.currentUser$ // Observable<User | null>
authService.isAuthenticated$ // Observable<boolean>

```

### ViewerService (Viewer-Specific State)

```typescript
// Manages coordinate, survey, label state
viewerService.currentState$ // Observable<ViewerStateModel>
viewerService.labels$ // Observable<ViewerLabelModel[]>
viewerService.catalogLabels$ // Observable<NearbyCatalogLabelModel[]>

```

### Reactive Forms

All input fields use Angular Reactive Forms (`FormBuilder`, `FormGroup`) for type-safety and validation:

```typescript
stateForm = this.fb.group({
  ra: [0, [Validators.required, Validators.min(-180), Validators.max(360)]],
  dec: [0, [Validators.required, Validators.min(-90), Validators.max(90)]],
  fov: [1, [Validators.required, Validators.min(0.1), Validators.max(180)]],
  survey: ['VLASS', Validators.required],
});

```

---

## HTTP & Interceptors

### Interceptor Chain

```text
HTTP Request
    ↓
[1] LoggingInterceptor → Timestamps request, logs to queue
    ↓
[2] AuthInterceptor → Injects JWT token in Authorization header
    ↓
[3] ErrorInterceptor → Catches errors, shows user notifications
    ↓
↓ HTTP Call →
    ↓
[3] ErrorInterceptor catches response errors
    ↓
[2] Auth refreshes token if 401 (Unauthorized)
    ↓
[1] Logging logs response, adds to telemetry
    ↓
HTTP Response

```

### API Endpoints Called

**Viewer API:**

- `GET /api/viewer/state/<shortid>` → Resolve encoded state

- `POST /api/viewer/state` → Create new state + get shortid

- `GET /api/viewer/cutout` → Generate FITS cutout file

- `GET /api/viewer/nearby` → Nearby catalog labels (RA/Dec based)

**Posts API:**

- `POST /api/posts` → Create new post (draft)

- `GET /api/posts/<id>` → Get post by ID

- `PUT /api/posts/<id>` → Update post (draft edit)

- `POST /api/posts/<id>/publish` → Publish post (create revision)

- `GET /api/posts` → List published posts (paginated)

- `DELETE /api/posts/<id>` → Delete post (owner only)

**Auth API:**

- `POST /api/auth/login` → User login

- `POST /api/auth/register` → User registration

- `POST /api/auth/verify-mfa` → MFA verification

- `POST /api/auth/logout` → Invalidate session

**Logging API:**

- `POST /api/logs/batch` → Batch log entries from frontend

- `GET /api/admin/logs` → Paginated logs (admin only)

- `GET /api/admin/logs/summary` → Log count summary (admin only)

---

## Routing Strategy

### Route Configuration

```typescript
// app.routes.ts
const routes = [
  { path: '', redirectTo: '/landing', pathMatch: 'full' },
  { path: 'landing', component: LandingComponent },
  {
    path: 'auth',
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
      { path: 'verify-mfa', component: VerifyMfaComponent },
    ],
  },
  {
    path: 'view',
    component: ViewerComponent,
    // Dynamic routing: /view?state=<encoded> or /view/<shortid>
  },
  {
    path: 'posts',
    canActivate: [AuthenticatedGuard],
    children: [
      { path: '', component: PostsListComponent },
      { path: 'new', component: PostEditorComponent },
      { path: ':id', component: PostDetailComponent },
    ],
  },
  {
    path: 'admin',
    canActivate: [AdminGuard],
    children: [
      { path: 'logs', component: AdminLogsDashboardComponent },
      { path: 'moderation', component: ModerationComponent },
    ],
  },
  { path: '**', redirectTo: '/landing' }, // 404 fallback
];

```

### Route Guards

| Guard | Purpose | Check |
| --- | --- | --- |

| **AuthenticatedGuard** | Require login | `authService.isAuthenticated$` |

| **AdminGuard** | Require admin role | `authService.currentUser$.role === 'admin'` |

| **UnsavedChangesGuard** | Warn before leaving form | Component implements `CanComponentDeactivate` |

---

## Build & Deployment

### Build Commands

```bash

# Development (with source maps + watch)

pnpm start:web

# Production build (minified, optimized)

pnpm build:web

# Serve production build locally

pnpm serve:web

```

### Bundle Size Optimization

- **Code Splitting:** Lazy-load feature modules (auth, posts, admin)

- **Tree Shaking:** Remove unused Angular Material components

- **Minification:** Terser plugin removes dead code

- **CDN Resources:** Aladin Lite loaded from ESA CDN, not bundled

### Environment Handling

```typescript
// environment.ts (development)
export const environment = {
  apiUrl: 'http://localhost:3001',
  logLevel: 'debug',
  enableDevTools: true,
};

// environment.prod.ts (production)
export const environment = {
  apiUrl: 'https://api.vlass-portal.com',
  logLevel: 'error',
  enableDevTools: false,
};

```

**Configuration:** Injected at build time via `fileReplacements` in `project.json`.

---

## Testing Strategy

### Unit Tests (Vitest)

**Scope:** Services, utilities, formatters
**Coverage Target:** > 80%
**Run:** `pnpm test:web`

Example:

```typescript
describe('AuthService', () => {
  it('should login user with email and password', async () => {
    const result = await authService.login('user@example.com', 'password');
    expect(result.success).toBe(true);
    expect(authService.isAuthenticated()).toBe(true);
  });
});

```

### Component Tests (Jasmine)

**Scope:** Component logic, event handlers, lifecycle hooks
**Run:** `pnpm test:web`

Example:

```typescript
describe('ViewerComponent', () => {
  it('should toggle grid overlay on checkbox change', () => {
    component.gridOverlayEnabled = false;
    component.onGridOverlayToggle({ target: { checked: true } });
    expect(component.gridOverlayEnabled).toBe(true);
  });
});

```

### E2E Tests (Playwright)

**Scope:** Full user workflows across pages
**Run:** `pnpm e2e:web`

Example:

```typescript
test('User can create, edit, and publish a post', async ({ page }) => {
  await page.goto('/landing');
  await page.click('text=Login');
  // ... auth flow ...
  await page.click('text=New Post');
  await page.fill('[aria-label="Markdown editor"]', '# My Discovery');

  await page.click('text=Publish');
  await expect(page).toHaveURL(/posts\/\d+/);
});

```

---

## Performance Considerations

### Client-Side Caching

1. **HiPS Tile Cache:** Non-persistent, window-scoped LRU cache for Aladin tile requests

   - Max 100 tiles in memory

   - Clears on window close

   - Reduces network calls within single session

2. **Computed Properties:** Angular OnPush change detection minimizes rendering

   - Components marked with `changeDetection: ChangeDetectionStrategy.OnPush`

   - Only recalculates when @Input properties change

3. **localStorage Persistence:**

   - Auth token (JWT) saved for session resumption

   - User preferences (theme, layout) cached locally

   - Draft posts auto-saved (post editor)

### Network Optimization

| Strategy | Purpose |
| --- | --- |

| **HTTP Request Batching** | Frontend logs queued + flushed every 10s |

| **Pagination** | Posts list loads 50 items/page |

| **Lazy Loading** | Feature modules only load when routes activated |

| **Image Optimization** | PNG snapshots use max compression |

### Bundle Analysis

```bash

# Generate production build analysis

pnpm build:web --stats-json
npx webpack-bundle-analyzer dist/apps/vlass-web/stats.json

```

Typical production bundle:

- **main.js:** ~150 KB (gzipped)

- **material.css:** ~40 KB (gzipped)

- **Aladin Lite (CDN):** ~200 KB (external, not bundled)

---

## Development Workflow

### Local Development

```bash

# Install dependencies

pnpm install

# Start web + API locally

pnpm start:all

# Open browser

open http://localhost:4200

```

### Code Style

- **Linting:** ESLint (rules in `eslint.config.mjs`)

- **Formatting:** Prettier (auto-format on save)

- **Type Checking:** TypeScript strict mode enabled

### Git Workflow

1. Branch from `main` → `feature/feature-name`

2. Write tests for new code

3. Create PR → CI runs tests + linting

4. Merge → Deploy to staging

5. Smoke test → Merge to production

---

## Common Patterns

### RxJS Service Pattern

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DataService {
  private stateSubject = new BehaviorSubject<DataModel>(initialState);
  public state$: Observable<DataModel> = this.stateSubject.asObservable();

  updateState(data: DataModel): void {
    this.stateSubject.next(data);
  }
}

```

### Component with Reactive Forms

```typescript
export class FormComponent implements OnInit {
  form = this.fb.group({
    title: ['', Validators.required],
    content: ['', [Validators.required, Validators.minLength(10)]],
  });

  constructor(private fb: FormBuilder, private api: ApiService) {}

  ngOnInit(): void {
    this.form.valueChanges.subscribe(value => {
      // React to form changes
    });
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.api.submit(this.form.value).subscribe(...);
    }
  }
}

```

### Observable Subscription Management

```typescript
// Use async pipe in template to avoid manual unsubscribe
data$ = this.service.getData();

// Or use takeUntilDestroyed for imperative code
constructor(private destroyRef: DestroyRef) {
  this.service.getData()
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(data => { ... });
}

```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
| --- | --- | --- |

| **Module not found** | Missing imports | Check `app.routes.ts` + `imports: [...]` |

| **Styles not applying** | Component encapsulation | Add `::ng-deep` (sparingly) or use global styles |

| **HTTP 401 loop** | Token refresh failed | Clear localStorage, re-login |

| **Viewer not loading** | Missing `#aladinHost` ref | Check DOM template has element |

| **Test failures** | Changed API response | Update mock data in `.spec.ts` |

---

## References

- [VIEWER-CONTROLS.md](VIEWER-CONTROLS.md) — Detailed viewer control documentation

- [COMPONENTS.md](COMPONENTS.md) — Component-by-component breakdown

- [STYLING.md](STYLING.md) — UX/design system + Material theming

- [Angular Docs](https://angular.io/docs)

- [Material Design](https://material.angular.io/)

- [RxJS Docs](https://rxjs.dev/)

---

**Last Updated:** 2026-02-07
**Maintained By:** VLASS Portal Team

## **Next Review:** Post-MVP (v1.1 planning)
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
