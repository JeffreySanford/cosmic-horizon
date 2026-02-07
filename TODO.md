# VLASS Sky Portal — Development Roadmap (SAFe/AGILE)

**Last Updated:** 2026-02-07  
**Product Owner:** You  
**Scrum Master:** Self  
**Team Size:** Solo (scaling docs for future team growth)

---

## 📋 Program Vision

**MVP Goal:** Ship a delightful VLASS explorer with community research notebooks in 12 weeks.

**Success Metrics:**

- FCP <1s on 4G (Pillar 1: SSR)
- Permalink + snapshot works 100% (Pillar 2: Viewer)
- 5+ published posts with revisions (Pillar 3: Notebook)

**Release Target:** Week 12 (Early May 2026)

---

## 🎯 SAFe Portfolio Structure

### Product Epics (12-week MVP)

```text
┌─ EPIC-001: Instant Sky Landing (Pillar 1)
│  ├─ Feature: SSR Regional Preview
│  ├─ Feature: Location Privacy (Geohashing)
│  └─ Feature: Mobile Optimization
│
├─ EPIC-002: Interactive Viewer (Pillar 2)
│  ├─ Feature: Aladin Integration
│  ├─ Feature: Viewer State Serialization
│  ├─ Feature: Permalink Generation
│  └─ Feature: Snapshot Downloads
│
├─ EPIC-003: Research Notebook (Pillar 3)
│  ├─ Feature: Post CRUD
│  ├─ Feature: Markdown Editor + Viewer Blocks
│  ├─ Feature: Revision Tracking
│  ├─ Feature: Moderation UI
│  └─ Feature: Tag System
│
└─ EPIC-004: Infrastructure & Ops
   ├─ Feature: CI/CD Pipeline
   ├─ Feature: Kubernetes Deployment
   ├─ Feature: Monitoring & Logging
   └─ Feature: Local Dev Environment
```

---

## 🚀 Program Increment (PI) Planning — 12-week Roadmap

### PI-1: Weeks 1–4 (Foundation)

**Theme:** Core Angular SSR + NestJS + Database Setup  
**Goal:** Development environment ready, API scaffolding complete

#### Features (PI-1)

#### F1.1: Development Environment

- Nx workspace fully configured
- Docker Compose for Postgres + Redis
- pnpm workspace verified
- ESLint + Prettier validated
- Pre-commit hooks active

#### F1.2: NestJS API Scaffold

- POST /api/auth/login (GitHub OAuth)
- GET /api/observations/{ra,dec,radius} (stub data)
- GET /api/posts (index)
- Error handling + logging
- Request validation (class-validator)

#### F1.3: Postgres + Redis Setup

- User table (id, github_id, email, created_at, geopriv_accepted)
- Observation cache schema
- Session store (Redis)
- Migration tooling (TypeORM or Prisma)

#### F1.4: Angular SSR Project Structure

- Server-side main.server.ts working
- Client-side bootstrap complete
- Shared models library compiled
- SCSS setup (Material theme)

---

### PI-2: Weeks 5–8 (Pillar 1 + Pillar 2 Begin)

**Theme:** SSR + Viewer Integration  
**Goal:** Landing page ships, Aladin loads

#### Features (PI-2)

#### F2.1: SSR First Paint

- Geohash location detection (server-side)
- VLASS tile cache (Redis) for common regions
- Background PNG embedded in SSR HTML
- Responsive grid layout (mobile-first)
- SEO meta tags (title, description, og:image)
- FCP <1s validation (Lighthouse)

#### F2.2: Location Privacy

- Geohash precision 4 (5km radius)
- Opt-in toggle on landing page
- Coarse geohash stored in session (no persistence)
- Test: Geohash correctly maps to tile

#### F2.3: Aladin Lite Integration

- CDN script tag (async load)
- Viewer component wrapper
- Zoom/pan event listeners
- Coordinate display (RA/Dec)
- Survey selector (VLASS DR1, DSS2, etc.)

#### F2.4: Viewer State Serialization

- ViewerState interface (zoom, center, survey, overlays)
- URL encoding: `?state=<compressed_json>`
- Decode on page load + auto-position
- Test: State survives round-trip

---

### PI-3: Weeks 9–12 (Pillar 2 Complete + Pillar 3)

**Theme:** Permalinks + Notebook  
**Goal:** MVP ships with all 3 pillars

#### Features (PI-3)

#### F3.1: Permalink + Shortlink

- Generate shortid (nanoid)
- Store in Postgres: view_id → state
- GET /view/{shortid} → redirect with state
- Test: Shortid persists and resolves

#### F3.2: Snapshot Downloads

- Client-side canvas screenshot (html2canvas)
- Save as PNG with metadata (title, viewer state, date)
- Store artifact on filesystem (local) or S3 (if available)
- Max 10 snapshots per user (quota)

#### F3.3: Post CRUD

- POST /api/posts (create)
- GET /api/posts/{id} (detail + revisions)
- PUT /api/posts/{id} (update → new revision)
- DELETE /api/posts/{id} (soft delete)
- Auth: verified users only (GitHub email verified)

#### F3.4: Markdown Editor

- CodeMirror or Monaco
- Preview pane (live markdown + viewer block rendering)
- Toolbar: **bold**, *italic*, `code`, \`\`\`viewer\`\`\` block
- Auto-save draft to localStorage

#### F3.5: Viewer Blocks (Notebook Integration)

- Parser: `\`\`\`viewer { "state": {...} }\`\`\``
- Render as embedded Aladin instances
- Auto-snapshot on publish (server-side canvas?)
- Link viewer blocks back to parent post

#### F3.6: Revision System

- revision_num column in posts table
- Show "Edited N times" link
- Diff view (side-by-side markdown)
- Revert button (soft-delete old revision indicator)

#### F3.7: Moderation

- Hide post (soft delete, only mod can see)
- Lock post (prevent edits, allow reads)
- Flag UI (users can report)
- Audit log (who did what when)

#### F3.8: Tag System

- User proposes tag on publish
- Tag stored as JSON array in posts
- GET /api/tags (index, sorted by frequency)
- Tag cloud on feed
- Filter posts by tag: GET /api/posts?tags=vlass,deep-field

#### F3.9: Feed View (SSR)

- GET /api/posts (paginated, 20 per page)
- Sort: newest first, or by popularity (views)
- Post preview: title + 200 chars + thumbnail
- SSR both feed and post detail pages

---

## 📅 Sprint Planning (2-week Sprints)

### Sprint 1 (Weeks 1–2)

**Goal:** Dev env ready, API skeleton, DB schema

**User Stories:**

- US-1.1: As a dev, I want Docker Compose with Postgres + Redis so I can develop locally
  - Task 1.1.1: Write docker-compose.yml
  - Task 1.1.2: Create Makefile (make db-up, make db-reset)
  - Task 1.1.3: Verify pnpm nx workspace
  - Estimate: 3 days
  - Acceptance: `make db-up` works, psql accessible on localhost:5432

- US-1.2: As a developer, I want Basic CRUD endpoints so I can test the API structure
  - Task 1.2.1: NestJS module scaffold (UsersModule, ObservationsModule)
  - Task 1.2.2: Auth decorator + GitHub OAuth flow stub
  - Task 1.2.3: Observation GET endpoint (hardcoded data)
  - Estimate: 4 days
  - Acceptance: `GET /api/observations?ra=0&dec=90&radius=1` returns JSON

- US-1.3: As a dev, I want TypeORM / Prisma setup so I can manage migrations
  - Task 1.3.1: Choose ORM (recommend TypeORM for NestJS alignment)
  - Task 1.3.2: Write initial User + Post + Observation schemas
  - Task 1.3.3: Create migration CLI
  - Estimate: 3 days
  - Acceptance: `npm run typeorm migration:run` succeeds

**Sprint Metrics:**

- Planned: 10 story points
- Velocity target: 8 story points (will improve)
- Daily standup: 15 min (async Slack if solo)

---

### Sprint 2 (Weeks 3–4)

**Goal:** Angular SSR boots, Aladin loads, geohashing works

**User Stories:**

- US-2.1: As a user, I want the landing page to load in <1s so I can see beautiful VLASS background
  - Task 2.1.1: SSR main.server.ts + prerender landing page
  - Task 2.1.2: VLASS tile fetch + Redis caching
  - Task 2.1.3: Embed background PNG in HTML (base64)
  - Task 2.1.4: Lighthouse audit (FCP <1s)
  - Estimate: 5 days
  - Acceptance: FCP <1000ms, LCP <2000ms on 4G

- US-2.2: As a user, I want to optionally share my location for a personalized background
  - Task 2.2.1: Geohash lib integration (geohash-32)
  - Task 2.2.2: Client-side geolocation detection
  - Task 2.2.3: Coarse hash (precision 4), store in session
  - Task 2.2.4: Opt-in toggle UI
  - Estimate: 3 days
  - Acceptance: User can toggle; geohash precision is 5km; not persisted

- US-2.3: As a user, I want to see the Aladin viewer so I can explore the sky
  - Task 2.3.1: Add Aladin script tag (async)
  - Task 2.3.2: Aladin component (Vue/Angular wrapper)
  - Task 2.3.3: Survey selector dropdown
  - Task 2.3.4: RA/Dec display on hover
  - Estimate: 4 days
  - Acceptance: Aladin loads on client, zoom/pan works, overlay visible

**Sprint Metrics:**

- Planned: 12 story points
- Velocity target: 10+ story points

---

### Sprint 3 (Weeks 5–6)

**Goal:** Viewer state serialization, permalink generation

**User Stories:**

- US-3.1: As a user, I want to encode the viewer state into a URL so I can share my view
  - Task 3.1.1: ViewerState interface + getState() method in Aladin wrapper
  - Task 3.1.2: URL encoding (use URL.stringify or custom)
  - Task 3.1.3: Decode on navigation → auto-restore view
  - Task 3.1.4: Unit tests (state round-trip)
  - Estimate: 4 days
  - Acceptance: `?state=<encoded>` restores exact zoom/center/survey

- US-3.2: As a user, I want generated shortlinks for easy sharing
  - Task 3.2.1: Create /api/views POST endpoint
  - Task 3.2.2: Generate nanoid, store in Postgres
  - Task 3.2.3: GET /view/{shortid} → redirect with state
  - Task 3.2.4: E2E test shortlink flow
  - Estimate: 3 days
  - Acceptance: `/view/abc123` resolves, persists >7 days

- US-3.3: As a user, I want to download a PNG snapshot of my current view
  - Task 3.3.1: html2canvas integration
  - Task 3.3.2: Add "Save Snapshot" button
  - Task 3.3.3: Store PNG locally (or S3 if available)
  - Task 3.3.4: Limit to 10 snapshots per user
  - Estimate: 3 days
  - Acceptance: PNG downloads, contains viewer state in metadata (EXIF or filename)

**Sprint Metrics:**

- Planned: 10 story points
- Velocity target: 12+ story points (should be ramping up)

---

### Sprint 4 (Weeks 7–8)

**Goal:** Post CRUD, markdown editor, first posts published

**User Stories:**

- US-4.1: As a user, I want to create and edit markdown posts with a live preview
  - Task 4.1.1: CodeMirror or Monaco setup
  - Task 4.1.2: Markdown parser (marked or remark)
  - Task 4.1.3: Live preview pane
  - Task 4.1.4: Auto-save to localStorage
  - Estimate: 5 days
  - Acceptance: Editor renders markdown, preview updates live, draft persists

- US-4.2: As a user, I want to embed viewer blocks in posts that show embedded Aladin instances
  - Task 4.2.1: Parser for \`\`\`viewer\`\`\` blocks
  - Task 4.2.2: Render embedded Aladin per block
  - Task 4.2.3: Each block is interactive (zoom/pan)
  - Task 4.2.4: Unit tests
  - Estimate: 4 days
  - Acceptance: Multiple viewer blocks in one post, each responsive to clicks

- US-4.3: As a user, I want to publish posts so others can read my research
  - Task 4.3.1: POST /api/posts endpoint (auth required)
  - Task 4.3.2: Validate markdown + viewer blocks
  - Task 4.3.3: Create revision 1
  - Task 4.3.4: Return post ID + shortlink
  - Estimate: 3 days
  - Acceptance: POST succeeds, post is queryable, revision_num=1

**Sprint Metrics:**

- Planned: 12 story points
- Velocity target: 14+ story points

---

### Sprint 5 (Weeks 9–10)

**Goal:** Revision tracking, moderation, tag system

**User Stories:**

- US-5.1: As a user, I want to edit my posts and see all revisions
  - Task 5.1.1: PUT /api/posts/{id} → creates new revision
  - Task 5.1.2: Revision UI: "Edited N times" → dropdown
  - Task 5.1.3: Diff view (side-by-side markdown)
  - Task 5.1.4: Revert button (soft-delete old, keep history)
  - Estimate: 4 days
  - Acceptance: Edit post 3 times, see all 3 revisions, diff renders correctly

- US-5.2: As a moderator, I want to hide or lock posts for safety
  - Task 5.2.1: Add is_hidden, is_locked bools to posts table
  - Task 5.2.2: PATCH /api/posts/{id}/moderate endpoint (auth as mod)
  - Task 5.2.3: Soft-delete post (hide from feed, show "removed" if user tries direct link)
  - Task 5.2.4: Lock post (prevent edits, show "locked" banner)
  - Estimate: 3 days
  - Acceptance: Mod can hide/lock, users can't see hidden posts in feed

- US-5.3: As a user, I want to tag my posts for discoverability
  - Task 5.3.1: Add tags JSON array to posts table
  - Task 5.3.2: Parse user-suggested tags from UI
  - Task 5.3.3: GET /api/tags (index + frequency sort)
  - Task 5.3.4: Filter feed: GET /api/posts?tags=vlass,deep-field
  - Estimate: 3 days
  - Acceptance: User can add tags on publish, POST /api/posts accepts tags array, GET /api/posts filters by tag

**Sprint Metrics:**

- Planned: 10 story points
- Planned: 13+ story points

---

### Sprint 6 (Weeks 11–12)

**Goal:** Feed SSR, polish, testing, deployment ready

**User Stories:**

- US-6.1: As a user, I want a searchable feed of all published posts
  - Task 6.1.1: GET /api/posts (paginated, 20 per page)
  - Task 6.1.2: Sort options (newest, popular)
  - Task 6.1.3: Feed view SSR (Angular)
  - Task 6.1.4: Post detail page SSR
  - Estimate: 4 days
  - Acceptance: Feed loads, pagination works, SEO meta tags

- US-6.2: As a user, I want a fully functional end-to-end experience
  - Task 6.2.1: UX polish (button sizing, spacing, colors)
  - Task 6.2.2: Error handling + user feedback (toasts)
  - Task 6.2.3: Mobile responsive check (all views)
  - Task 6.2.4: Accessibility audit (a11y)
  - Estimate: 3 days
  - Acceptance: No console errors, mobile works, WCAG AA on key pages

- US-6.3: As a DevOps person, I want the app deployed to Kubernetes
  - Task 6.3.1: Dockerfile for Angular SSR + NestJS
  - Task 6.3.2: Helm chart (values, service, ingress)
  - Task 6.3.3: GitHub Actions CI/CD (build → push → deploy)
  - Task 6.3.4: Basic monitoring (health check, logs)
  - Estimate: 4 days
  - Acceptance: Helm deploy works, app responds to `/health`, logs to stdout

- US-6.4: As a maintainer, I want comprehensive testing
  - Task 6.4.1: Unit tests (services, pipes, components) >80% coverage
  - Task 6.4.2: API integration tests (POST /api/posts, etc.)
  - Task 6.4.3: E2E tests (landing → create post → view revision)
  - Task 6.4.4: Playwright visual regression (landing page)
  - Estimate: 3 days
  - Acceptance: `npm test` passes, `npm run e2e` passes, coverage report shows >80%

**Sprint Metrics:**

- Planned: 14 story points
- Velocity target: 14+ story points (stable)

---

## 🛠️ Implementation Checklist (Per Feature)

### Feature: F1.1 — Development Environment

- [ ] Clone repo, install pnpm
- [ ] Run `git log` → confirm commits exist
- [ ] Run `pnpm install` → no errors
- [ ] Run `pnpm nx graph` → visualize workspace
- [ ] Create `.env.local` (database host, port, password)
- [ ] Install Docker Desktop
- [ ] Write `docker-compose.yml` (postgres:15, redis:latest)
- [ ] Write `Makefile` with `make db-up`, `make db-reset`, `make db-logs`
- [ ] Run `make db-up` → postgres accessible on localhost:5432
- [ ] Create initial migration template
- [ ] ESLint passes: `pnpm nx run-many --target=lint`
- [ ] Git pre-commit hook: lint before commit
- [ ] README.md updated with setup instructions

---

### Feature: F1.2 — NestJS API Scaffold

- [ ] Generate NestJS app in `apps/vlass-api`
- [ ] Create `UsersModule` (signup/login, GitHub OAuth stub)
- [ ] Create `ObservationsModule` (GET endpoint, hardcoded VLASS data)
- [ ] Add `@UseGuards(AuthGuard)` to protected routes
- [ ] Create `auth.service.ts` + `auth.controller.ts`
- [ ] Add class-validator for request DTOs
- [ ] Add global exception filter (HttpExceptionFilter)
- [ ] Add logging decorator (@Logger)
- [ ] Unit tests for auth service (100% coverage)
- [ ] API integration tests (call endpoints, verify responses)
- [ ] API documentation (Swagger/OpenAPI, optional for MVP)
- [ ] Test with Postman / cURL

---

### Feature: F1.3 — Postgres + Redis Setup

- [ ] TypeORM config (ormconfig.ts or AppModule options)
- [ ] User entity: id, github_id, email, created_at, updated_at, geopriv_accepted
- [ ] Observation entity: id, ra, dec, timestamp, catalog_ref (optional)
- [ ] Post entity: id, user_id, title, markdown, tags (JSON), revision_num, created_at, updated_at, is_hidden, is_locked
- [ ] ViewerState entity: id, shortid (unique), state (JSON), user_id (nullable), created_at
- [ ] Migration templates created
- [ ] Redis session store configured (express-session + redis)
- [ ] Run migration: `npm run typeorm migration:run`
- [ ] Verify tables in postgres

---

### Feature: F2.1 — SSR First Paint

- [ ] Angular universal config (main.server.ts)
- [ ] Server-side render landing page
- [ ] Fetch VLASS tile for default (or coarse) region (server-side)
- [ ] Cache tile PNG in Redis (TTL 1 day)
- [ ] Embed tile as background image in main layout
- [ ] Responsive CSS Grid (mobile-first, breakpoints: 480px, 768px, 1024px)
- [ ] CSS-in-JS or SCSS (Material 3 theme)
- [ ] SEO meta tags (title, description, og:image, viewport)
- [ ] Build production bundle: `npm run build`
- [ ] Test with Lighthouse CI: FCP <1000ms, LCP <2000ms
- [ ] Test on mobile emulator (DevTools throttling 4G)

---

### Feature: F2.2 — Location Privacy

- [ ] Install `geohash-32` library
- [ ] Add geohash service: `geohash.encode(lat, lon, precision)`
- [ ] Client-side geolocation: `navigator.geolocation.getCurrentPosition()`
- [ ] Coarse hash: precision 4 (~ 5km radius)
- [ ] Store hash in session (Redis), not cookies or localStorage
- [ ] Opt-in toggle on landing page ("Use my location to personalize preview")
- [ ] On toggle: fetch coarse tile matching geohash, update background
- [ ] Test: Confirm geohash decoded back to 5km radius (expected location bounds)
- [ ] Privacy policy note: "We don't retain your location after you close the browser"

---

### Feature: F2.3 — Aladin Lite Integration

- [ ] Add Aladin script tag to `index.html` (async, defer)
- [ ] Create Aladin component (wrapper)
- [ ] Initialize on client-side hydration (not server)
- [ ] Add zoom/pan listeners
- [ ] Display RA/Dec on mouse move (top-right corner)
- [ ] Survey selector dropdown: VLASS DR1, DSS2, 2MASS, etc.
- [ ] Load selected survey on change
- [ ] Test on desktop + mobile (touch zoom works)

---

### Feature: F2.4 — Viewer State Serialization

- [ ] Define ViewerState interface: `{ zoom: number, center: {ra, dec}, survey: string, overlays?: string[] }`
- [ ] Implement `getState()` method in Aladin wrapper
- [ ] Implement `setState(state)` method (restore view)
- [ ] URL encoding: `encodeURIComponent(JSON.stringify(state))` → `?state=` query param
- [ ] On page load: parse `?state=` param, call `setState()`
- [ ] Unit tests: encode → decode → verify equality
- [ ] E2E test: navigate to URL with state, verify visual match (or bounds match)

---

### Feature: F3.1 — Permalink + Shortlink

- [ ] Create ViewerState entity (see Data Model section)
- [ ] POST /api/views (body: { state, title? }) → create record, generate shortid
- [ ] Use nanoid or uuid library (recommend nanoid for short URLs)
- [ ] Shortid unique constraint in database
- [ ] GET /view/{shortid} → redirect with ?state= query param
- [ ] Test: POST → GET → verify state matches
- [ ] Test persistence: wait 1 week, verify shortid still resolves

---

### Feature: F3.2 — Snapshot Downloads

- [ ] Install `html2canvas` library
- [ ] Add "Save Snapshot" button in viewer footer
- [ ] On click: `html2canvas(viewerElement)` → PNG
- [ ] Download PNG via `<a href=blob: download="vlass-snapshot.png">`
- [ ] Store filename metadata (timestamp, viewer state)
- [ ] Optional: Save snapshot to filesystem (`/tmp/snapshots/<uuid>.png`)
- [ ] Quota: max 10 snapshots per user (track in database)
- [ ] Test: Download snapshot, verify file size >100KB, PNG header correct
- [ ] Test: Can't exceed quota (11th attempt returns 403)

---

### Feature: F3.3 — Post CRUD

- [ ] POST /api/posts (auth required)
  - [ ] Validate: title, markdown not empty
  - [ ] Create post with revision_num = 1
  - [ ] Return { id, shortid, revision_num }
- [ ] GET /api/posts (paginated)
  - [ ] Default: 20 per page, newest first
  - [ ] Support `?page=2&sort=popular`
  - [ ] Return posts with post_count, view_count
- [ ] GET /api/posts/{id} (detail)
  - [ ] Include all revisions
  - [ ] Include revision_count
- [ ] PUT /api/posts/{id} (update)
  - [ ] Only author can edit
  - [ ] Create new revision (copy old markdown to revision_history)
  - [ ] Increment revision_num
- [ ] DELETE /api/posts/{id} (soft delete)
  - [ ] Set is_hidden = true
  - [ ] Return 204 No Content
- [ ] Unit tests for all endpoints
- [ ] E2E test: create → read → update → read again

---

### Feature: F3.4 — Markdown Editor

- [ ] Install CodeMirror v6 or Monaco
- [ ] Create `PostEditorComponent` (full-screen editor)
- [ ] Left pane: editor, right pane: live preview
- [ ] Toolbar: **bold**, *italic*, `code`, | ~strikethrough~, link, \`\`\`viewer {}\`\`\`
- [ ] Keyboard shortcuts: Ctrl+B (bold), Ctrl+I (italic), etc.
- [ ] Auto-save to localStorage every 10 seconds
- [ ] Save button: POST /api/posts (if new) or PUT /api/posts/{id} (if edit)
- [ ] Warn user on unload if unsaved changes
- [ ] Test: Type 1000 chars, auto-save triggers, refresh page, content recovered

---

### Feature: F3.5 — Viewer Blocks (Notebook Integration)

- [ ] Markdown parser: remark or marked
- [ ] Custom plugin to parse \`\`\`viewer { ... }\`\`\`` blocks
- [ ] Extract JSON from block, validate against ViewerState
- [ ] Render each block as embedded Aladin instance
- [ ] Each block inherits zoom/pan listeners (fully interactive)
- [ ] Click "Link to full view" → navigates to /view/{shortid}
- [ ] CSS: embed in post layout, responsive width (100% of post container)
- [ ] Test: 5 viewer blocks in one post, each independently responsive
- [ ] Performance: ensure 5+ blocks don't slow down page

---

### Feature: F3.6 — Revision System

- [ ] POST revision on every save
  - [ ] Store markdown_content in revision_history JSON
  - [ ] Increment revision_num
- [ ] GET /api/posts/{id}/revisions (list all)
  - [ ] Include revision_num, updated_at, user_id
- [ ] GET /api/posts/{id}/revisions/{num} (specific)
  - [ ] Return markdown for that revision
- [ ] Diff view: side-by-side markdown
  - [ ] Highlight: +added, -removed, ~changed
  - [ ] Use diff-match-patch library
- [ ] Revert button: create new revision with old content
  - [ ] Revert ≠ delete; it's a new revision copying old text
  - [ ] Show "Reverted to revision X" message
- [ ] Test: Edit post 3 times, see all in dropdown, diff renders, revert works

---

### Feature: F3.7 — Moderation

- [ ] Add is_hidden, is_locked columns to posts
- [ ] PATCH /api/posts/{id}/moderate (admin/mod only)
  - [ ] Body: { action: 'hide' | 'unhide' | 'lock' | 'unlock' }
  - [ ] Update post flags
  - [ ] Audit log: store moderator_id, action, timestamp
- [ ] GET /api/posts (exclude is_hidden posts unless user is author)
- [ ] GET /api/posts/{id} (if is_hidden, only author + moderator can view)
- [ ] POST /api/posts/{id}/report (user reports post for violation)
  - [ ] Store in reports table: { post_id, reporter_id, reason, timestamp }
  - [ ] Mod dashboard (future): view reported posts
- [ ] UI feedback: show "This post was hidden" if user tries to access
- [ ] Test: Hide post, verify not in feed; author can still view; mod can unhide

---

### Feature: F3.8 — Tag System

- [ ] Add tags JSON array column to posts table
- [ ] On publish: user proposes tags (comma-separated or multi-select)
- [ ] Validate: lowercase, alphanumeric + dash, max 30 chars each
- [ ] Store as ["vlass", "deep-field", "discovery"]
- [ ] GET /api/tags (aggregated, sorted by frequency)
  - [ ] Response: `[{ tag: "vlass", count: 15 }, { tag: "deep-field", count: 8 }]`
- [ ] GET /api/posts?tags=vlass,deep-field (filter)
  - [ ] Returns posts with all specified tags (AND logic)
  - [ ] Alternative: ?tags=vlass|deep-field (OR logic) for future
- [ ] Tag cloud on feed: render tags with font-size proportional to count
- [ ] Tag click: filter posts by that tag
- [ ] Test: Create 5 posts with various tags, verify count aggregation, filter works

---

### Feature: F3.9 — Feed View (SSR)

- [ ] Feed route: `/` (homepage, SSR)
- [ ] GET /api/posts (paginated, server-side call)
- [ ] Display post preview:
  - [ ] Title (clickable → detail page)
  - [ ] Author + creation date
  - [ ] First 200 chars of markdown
  - [ ] Tag cloud
  - [ ] View count + "Edited N times" badge
  - [ ] Thumbnail of first viewer block (if any)
- [ ] Pagination controls (previous / next)
- [ ] Post detail page: full markdown + all viewer blocks + revisions dropdown
- [ ] SEO: og:title, og:description, og:image (snapshot of first viewer block)
- [ ] Test: Load feed, click post, view revision history, revisions render correctly

---

## 🧪 Testing Strategy (Per Pillar)

### Pillar 1: SSR First Paint

- **Unit Tests:** Geohash encoding, tile cache logic, metadata generation
- **Integration Tests:** Server-side fetch + Redis cache hit/miss
- **E2E Tests:** Load landing page, measure FCP/LCP, verify background loads
- **Visual Regression:** Playwright snapshot of landing page (desktop + mobile)
- **Performance:** Lighthouse CI (FCP <1s, LCP <2s target)

### Pillar 2: Viewer + Permalinks

- **Unit Tests:** ViewerState serialization, state round-trip
- **Integration Tests:** Aladin initialization, survey loading
- **E2E Tests:** Navigate to URL with state, verify zoom/center restored
- **E2E Tests:** Generate shortlink, share, resolve in new tab
- **E2E Tests:** Snapshot download, file created, metadata valid
- **Visual Regression:** Aladin viewer state matches screenshot

### Pillar 3: Notebook

- **Unit Tests:**
  - Markdown parser + viewer block extraction
  - Revision diff logic
  - Tag frequency aggregation
- **Integration Tests:**
  - POST /api/posts (create), PUT (edit), GET (read)
  - Revision creation + retrieval
  - Moderation flags
- **E2E Tests:**
  - Create post with 3 viewer blocks
  - Edit post 2 times
  - View revision history
  - View diff between revisions
  - Hide post (as mod), verify not in feed
  - Filter feed by tag
  - Full feed loading (SSR)
- **Visual Regression:**
  - Markdown editor preview (various markdown)
  - Post detail page (multiple revisions visible)
  - Feed card layout (mobile + desktop)

---

## 📊 Metrics & Health Dashboard

### Week-by-Week Goals

| Week   | Pillar         | KPI                                  | Target |
| ------ | -------------- | ------------------------------------ | ------ |
| 1-2    | Infrastructure | Dev env setup time <30 min           | ✅     |
| 1-4    | API            | API endpoint coverage = 100%         | ✅     |
| 1-4    | DB             | Schema finalized, migrations working | ✅     |
| 5-6    | Pillar 1       | FCP <1s, LCP <2s                     | ✅     |
| 5-8    | Pillar 2       | Permalink generation 100% success    | ✅     |
| 9-10   | Pillar 3       | 5+ published posts                   | ✅     |
| 11-12  | QA             | Test coverage >80%, E2E passes       | ✅     |
| 12     | Deploy         | Helm deployment successful           | ✅     |

### Code Quality Metrics

- **Test Coverage:** >80% (goal: 90%)
- **ESLint:** 0 errors, 0 warnings
- **Bundle Size:** Main JS <200KB (gzipped), CSS <50KB
- **Performance:** Lighthouse score >90
- **Accessibility:** WCAG AA on critical pages

### Deployment Metrics

- **Deployment frequency:** 1x per week (sprints)
- **Mean time to recovery (MTTR):** <30 min
- **Error rate:** <0.1%
- **Uptime:** 99.5%

---

## 🎯 Done Definition (Definition of Done)

A task / story / feature is "done" when:

1. **Code written** with clear, self-documenting function names
2. **Tests pass** (unit + integration)
3. **Code reviewed** by at least 1 other person (or self-review with checklist)
4. **Linting passes** (ESLint, Prettier)
5. **Documentation updated** (README, JSDoc, API docs if applicable)
6. **Merged to main** with passing CI
7. **Deployed to staging** (or local equivalent)
8. **Acceptance criteria met** (per user story)
9. **No known regressions** (existing tests still pass)

---

## 🚨 Risk Register

| Risk                                | Probability | Impact | Mitigation                            |
| ----------------------------------- | ----------- | ------ | ------------------------------------- |
| Aladin Lite unexpected behavior     | Medium      | High   | Test early (Sprint 2), Mode B docs v2 |
| Geohashing privacy policy unclear   | Low         | Medium | Consult legal; opt-in only            |
| N+1 query problem (POST + revision) | Medium      | Medium | Use JOIN in SQL, test 1000+ posts     |
| VLASS tile fetch slow               | Medium      | High   | Cache Redis 1 day, precompute tiles   |
| Markdown parser edge cases          | Low         | Low    | Use marked/remark lib, fuzzing tests  |
| Kubernetes / Helm deployment fails  | Low         | High   | Test with minikube before prod        |
| GitHub OAuth session expires        | Low         | Low    | Refresh token flow, logout 7 days     |
| Snapshot file quota abuse           | Low         | Low    | Rate limit 1/min, max 10/user         |

---

## 🔄 Release Plan

### MVP Release (Week 12)

#### Pre-Release (Week 11)

- [ ] Full test pass (unit + integration + E2E)
- [ ] Code freeze (no new features)
- [ ] Staging deployment
- [ ] Lighthouse audit (>90 score)
- [ ] Security audit (no SQL injection, XSS, CSRF)
- [ ] Checklist: auth tokens, env vars, secrets management

#### Release Day (Friday of Week 12)

- [ ] Tag version v1.0.0 in Git
- [ ] Build production Docker image
- [ ] Deploy to Kubernetes (production)
- [ ] Smoke tests: landing page loads, create post, view feed
- [ ] Announce (Twitter, astronomy communities)

#### Post-Release (Week 13+)

- [ ] Monitor error rates, performance
- [ ] Collect user feedback
- [ ] Plan v1.1 (comments, better search)

---

## 🎓 Learning & Iteration

### Post-MVP Roadmap (v1.1 & v2)

#### v1.1 (2–4 weeks after MVP)

- Comment system (comments on posts + replies)
- Better search (full-text search, elasticsearch optional)
- User profiles (bio, avatar, follower list)
- Email notifications (new replies, new posts from followed users)

#### v2 (2–3 months after MVP)

- Mode B (Canvas viewer) if Aladin is insufficient
- FITS proxy (with NRAO approval + feature flag)
- Rust rendering service (advanced PNG composition)
- Collaboration features (team notebooks)
- Advanced analytics (usage metrics, popular posts)

---

## 📝 Notes

**Key Assumptions:**

- Solo development (scaling workflow for team growth in v1.1)
- Kubernetes cluster available at VLA
- GitHub OAuth available and working
- VLASS data APIs accessible (Ra/Dec queries)

**Decisions Locked (See SCOPE-LOCK.md):**

- ✅ Aladin only (Mode B deferred)
- ✅ FITS link-out (no proxy)
- ✅ 90d audit retention (no cold tier)
- ✅ No Go code (removed)
- ✅ No required Rust (optional in v2)

**Open Questions for Future Sprints:**

- Should we add comment threading (v1.1)?
- Should we support LaTeX math rendering in posts?
- Should we track post view counts?
- Should we implement follow/unfollow users?

---

## ✅ Approval & Sign-Off

- **Product Owner (You):** Ready to start Sprint 1?
- **Scrum Master (You):** Any blockers?
- **Team (You):** Copy this into your task tracker (Linear, Jira, Notion, etc.)

**Start Date:** Week 1 of 12-week sprint cycle  
**Target MVP Release:** Week 12 (early May 2026)

---

👉 **Next Step:** Pick Sprint 1 tasks, estimate story points, start building!
