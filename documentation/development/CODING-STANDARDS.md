# Coding Standards & Build Stages

## Angular & Enterprise Standards

### Angular Guidelines

These standards apply to Angular 19 with Nx 20 workspace management and keep every component inside NgModules so shared services, material imports, and route resolvers resolve predictably.

- **NEVER use standalone components** – the enterprise-grade architecture depends on NgModule declarations, shared import graphs, and guardrail validation; allowing standalone components would fragment dependencies and make auditing harder.
- **NEVER use Angular Signals** – we require the Observable + RxJS pattern (hot, shareable observables) for transparent state flow. Signals hide subscription timing, bypass established facades, and erode the guardrail instrumentation we audit on every release.
- **NEVER use Zoneless Angular** – `Zone.js` provides async tracking, consistent change detection, and diagnosable stacks that are critical for tracing call/response flows and spotting illegal content shared by anonymous clients. Dropping Zones would break those audits.
- Always declare components inside their NgModule and keep `standalone: false`.
- Favor shared material modules over `CUSTOM_ELEMENTS_SCHEMA` so Angular can validate module imports before runtime.
- Hot observables (e.g., `shareReplay`, `BehaviorSubject`, facades) drive state; avoid Promises for recurring or multi-subscriber data.
- Prefer reactive forms for complex input and leverage resolvers for route data hydration to minimize flicker and duplication.
- Use dependency injection and `providedIn: 'root'` services so guards, interceptors, and sockets can reuse DTO-powered logic consistently.
- Prefer Angular's `inject()` helper over constructor injection when wiring services or helpers into components/services so dependencies stay explicit and easier to mock during tests.
- **Favor `inject()` everywhere**: guard against implicit constructor wiring by calling `inject()` (or helper `provideXxx()` wrappers) inside guards, interceptors, resolvers, and components so every dependency path can be overridden in tests without relying on metadata reflection.

### Enterprise Enforcement: Standalone, Signals & Promise Policy

To ensure auditability, consistency, and predictable change-detection across the entire monorepo, the following rules are strictly enforced:

- **NEVER** use `standalone: true` components. All components must be declared in an `NgModule` and explicitly set `standalone: false`.
- **NEVER** import or use Angular Signals (`signal`, `computed`, `effect`, `Signal`, `WritableSignal`, `injectSignal`, etc.). Use RxJS Observables for all reactive patterns.
- **NEVER** construct `Promise` objects (e.g., `new Promise(...)`) or rely on `.then` chaining inside services or controllers. Services and controllers should return `Observable` types or use adapter patterns to convert one-off interop calls into `Observable` streams.

**Rationale:** These rules favor enterprise-level observability, easier automated auditing, and predictable behavior for guardrails and instrumentation. They also make code reviews deterministic and reduce accidental bypass of guardrail instrumentation.

**Exceptions:** Exceptions are allowed only via a documented approval process. Any PR that requires an exception must include a short justification in its description and be explicitly approved by an owner listed in `CODEOWNERS` (add reviewer name and date in the PR body). Exceptions are recorded in the governance log with rationale and duration.

### Typing & Shared DTO Policy

Strong typing is mandatory across the workspace to prevent `any`/`unknown` creeping into services, controllers, or shared logic. Follow these rules:

- **NO `any` or `unknown`**: Avoid `any` and `unknown` types in all production code. Use concrete interfaces/types or shared DTOs from `@shared/models` instead.
- **DTO-first**: All cross-service messages (viewer state, auth tokens, community posts, manifest responses) must be defined in `libs/shared/models` and exported as named types/interfaces.
- **Explicit types everywhere**: Functions, class properties, module exports, and public APIs must have explicit type annotations. Prefer `interface`/`type` aliases for DTOs, and `Readonly`/`ReadonlyArray` where mutation should be prevented.
- **Building types from any/unknown**: When you encounter `any` or `unknown` in existing code, **build proper interfaces** rather than just removing them. Example:
  - ❌ **Don't do**: Delete the parameter entirely
  - ✅ **Do this**: Create a proper interface and use it:

    ```typescript
    // Create interface based on actual usage
    export interface ErrorDetails {
      message?: string;
      code?: string;
      status?: number;
      timestamp?: string;
    }

    // Replace: catchError((err: any) =>
    // With: catchError((err: Error | ErrorDetails) =>
    ```

  - For event handlers like `onChange`, `onTouch`, implement them or add `// TODO: Implement handler` comments rather than just removing

- **Typing exceptions**: Temporary exceptions during prototyping are allowed but must be documented in the PR and converted to typed APIs before merging to `master`.

**Enforcement:**

- ESLint rules enforce `no-explicit-any`, ban `unknown`, and require explicit type annotations (`@typescript-eslint/typedef`).
- CI runs a typed linter job; PRs must pass the typed-lint before merge.

### Component Configuration Example

```typescript
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-example',
  templateUrl: './example.component.html',
  styleUrls: ['./example.component.scss'],
  standalone: false, // CRITICAL: Must always be explicitly set to false for all components
})
export class ExampleComponent implements OnInit {
  // Component implementation
  constructor() {}

  ngOnInit(): void {}
}
```

### Module Configuration Example

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module'; // Example shared module
import { ExampleComponent } from './example.component';
import { OtherComponent } from './other.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@NgModule({
  declarations: [
    ExampleComponent, // Always declare components here
    OtherComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    MatButtonModule, // Explicitly import all needed Angular Material modules
    MatIconModule, // rather than using CUSTOM_ELEMENTS_SCHEMA
  ],
  exports: [
    ExampleComponent, // Export components intended for use outside this module
  ],
})
export class FeatureModule {}
```

## Error Handling Standards

### Catch Clause Type Annotations

TypeScript requires catch clause parameters to be typed as `unknown` (per ECMAScript spec). To satisfy strict type checking, implement proper type narrowing:

```typescript
// ✅ CORRECT: Use unknown with proper type guards
try {
  await someAsyncOperation();
} catch (error: unknown) {
  // eslint-disable-next-line no-restricted-syntax -- TypeScript spec requires unknown in catch clauses
  const errorMessage: string =
    error instanceof Error ? error.message : String(error);
  logger.error('Operation failed:', errorMessage);
}

// ✅ CORRECT: Handle different error types
try {
  await httpService.get(url);
} catch (error: unknown) {
  // eslint-disable-next-line no-restricted-syntax
  if (error instanceof HttpException) {
    handleHttpError(error);
  } else if (error instanceof Error) {
    handleStandardError(error);
  } else {
    handleUnknownError(error);
  }
}
```

### RxJS Error Handling in Observables

For RxJS operators like `catchError`, properly type parameters even though they originate from `unknown`:

```typescript
// ✅ CORRECT: Type the error parameter
return this.http.get(url).pipe(
  catchError((error: unknown): Observable<DefaultResponse> => {
    // eslint-disable-next-line no-restricted-syntax
    const message: string = error instanceof Error ? error.message : String(error);
    logger.error('HTTP error:', message);
    return of(DEFAULT_RESPONSE);
  })
);

// ✅ CORRECT: Use type guards with proper narrowing
private isHttpError(err: unknown): err is HttpErrorResponse {
  return err instanceof HttpErrorResponse;
}

private handleError(error: unknown): void {
  // eslint-disable-next-line no-restricted-syntax
  if (this.isHttpError(error)) {
    this.logger.error(`HTTP ${error.status}:`, error.message);
  } else if (error instanceof Error) {
    this.logger.error('Standard error:', error.message);
  }
}
```

### Interface Design for Error Handling

Define error interfaces instead of relying on `any`:

```typescript
export interface AppError {
  message: string;
  code: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

export interface ValidationError extends AppError {
  field: string;
  value: unknown;
}
```

## Real-Time Communication Standards

### Socket.IO Implementation

When implementing Socket.IO functionality, follow these standards:

```typescript
// Backend Socket Emission (NestJS)
import { Injectable } from '@nestjs/common';
import { SocketService } from '../socket/socket.service';

@Injectable()
export class DataService {
  constructor(private socketService: SocketService) {}

  updateData(data: any): void {
    // Process data
    // Emit to clients - use specific, namespaced event names
    this.socketService.emitToAll('data:update', data);
  }
}

// Frontend Socket Reception (Angular)
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { SocketClientService } from './socket-client.service';

@Injectable({
  providedIn: 'root',
})
export class DataFacade implements OnDestroy {
  private dataSubject = new BehaviorSubject<DataType[]>([]);
  readonly data$ = this.dataSubject.asObservable();
  private destroyed$ = new Subject<void>();

  constructor(private socketClient: SocketClientService) {
    this.socketClient
      .on<DataType[]>('data:update')
      .pipe(
        takeUntil(this.destroyed$),
        distinctUntilChanged(
          (prev, curr) => JSON.stringify(prev) === JSON.stringify(curr),
        ),
      )
      .subscribe((data) => {
        this.dataSubject.next(data);
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }
}
```

### Socket Event Naming Conventions

Socket events should use a consistent, namespaced approach with colon separators:

- **Format:** `domain:entity:action`
- **Examples:**
  - `audit:event:logged`
  - `viewer:state:changed`
  - `community:post:published`
  - `mod:action:queued`
  - `ops:cache:stats`

## Large Dataset Handling

For optimal performance with large datasets, follow these guidelines:

- For datasets under 100,000 records: Use client-side rendering with full dataset loaded
- For datasets over 100,000 records: Use server-side rendering with pagination

### Implementation Pattern

```typescript
// Backend Service (NestJS)
@Injectable()
export class RecordService {
  async getRecords(page: number, pageSize: number, total: number): Promise<RecordResponse> {
    if (total > 100000) {
      return this.getServerSidePaginatedRecords(page, pageSize);
    }
    return this.getAllRecords(total);
  }

  private async getServerSidePaginatedRecords(page: number, pageSize: number): Promise<RecordResponse> {
    const skip = page * pageSize;
    const records = await this.recordRepository.find({
      take: pageSize,
      skip: skip,
      order: { id: 'ASC' }
    });

    const totalCount = await this.recordRepository.count();
    return {
      records,
      totalCount,
      serverSidePagination: true
    };
  }
}

// Angular Component
@Component({...})
export class RecordListComponent implements OnInit {
  dataSource: MatTableDataSource<Record> | null = null;
  serverSidePagination = false;

  onTableChange(event: PageEvent): void {
    if (this.serverSidePagination) {
      this.recordService.getRecords(event.pageIndex, event.pageSize, this.totalRecords)
        .pipe(takeUntil(this.destroy$))
        .subscribe(response => {
          this.dataSource.data = response.records;
        });
    }
  }
}
```

## Design System Specifications

- Use `em` for sizing and spacing by default (padding, margin, gaps, widths, heights, font sizes).
- Keep `px` for hairline details and optical effects (borders, outlines, shadows, and similar 1–2px treatments).
- Keep layout breakpoints in `px` to preserve responsive behavior.

## VLASS-Specific Standards

### Build & Testing

**Tests gate the build** — `nx lint`, `nx test`, `nx build`, `nx e2e` must all pass. No exceptions.

**All upstream endpoints must be server-only** — never exposed in client bundles. Sanitized public config is emitted via a gated endpoint.

**RxJS hot observables drive the async model**:

- Controllers return `Observable` stubs, never `async`/`await`
- ViewerState, audit streams, and ws transports are `BehaviorSubject` or multicast observables
- Consume via pipes and `async` pipe in templates

### Code Organization

**Code separation**:

- Angular components live in **/ui/** and must respect module boundaries (not modules declared in multiple places)
- NestJS guards and services live in **/server/**
- DTOs/contracts live in **libs/shared/models** and are versioned

### VLASS Data & Guardrails

**Proxy is not a mirror**:

- On-demand only, no bulk scraping
- Hard size caps (1.5 GB default)
- TTL enforcement (43200 seconds / 12 hours default)
- Concurrency caps (6 concurrent requests default)
- Anti-crawl detection audited
- Upstream allowlist only: `vlass-dl.nrao.edu,data-query.nrao.edu,data.nrao.edu,cds.unistra.fr`
- Circuit breaker on upstream failures

**Public data only**:

- FITS access gated to verified users
- No proprietary or non-public sources
- Advanced metadata search links to official NRAO tools only (no hosting)

**Location privacy**:

- Store coarse location only (rounded/geohash, low precision)
- Audit logs redact location
- User opts in explicitly or enters city/state manually

**Verification gating**:

- Unverified: 20 req/min, no publish/comment, shallow zoom, PNG only
- Verified: 300 req/min, full publish/comment, FITS allowed
- Admin/Moderator: ops access, audit logs, user management

## Developmental Stages (Strict Gating)

Each stage ends with tests passing, policies enforced, and auditability verified.

### Stage 0 — Repo Skeleton + Policy Gates (Foundation)

**Deliverables:**

- NX workspace layout with three apps + shared libs
- Hard gates: fail build if any component is `standalone: true`
- Fail build if proxy allowlist not enforced
- Baseline CI: `nx lint`, `nx test`, `nx build`, `nx e2e`

**Acceptance:**

- Clean clone → one command pipeline → green

### Stage 1 — SSR Landing + Anonymous Location Flow

**Deliverables:**

- SSR landing page renders a generic background immediately
- Location UX: "Use my location" and "Enter city/state"
- Signed coarse location cookie
- `/view/preview` endpoint exists (returns small PNG) and is cache-bounded

**Acceptance:**

- First visit: generic background
- After location submit: next visit SSR shows regional preview
- Audit logs contain no raw lat/lon

### Stage 2 — Auth + Dev-Mode Verification + Throttling Tiers

**Deliverables:**

- Email/password register/login
- Dev-mode verification: verification token logged (optionally returned in dev only)
- Rate limiting tiers: anon / unverified / verified
- Basic RBAC wiring (User default role)

**Acceptance:**

- Unverified cannot publish/comment
- Verified can
- Rate limit status observable via ops endpoint (role-gated)

### Stage 3 — ViewerState Backbone + Viewer Switcher

**Deliverables:**

- Angular `ViewerStateStore` implemented as hot observable
- Switcher UI: Mode A ↔ Mode B toggle with state preserved across toggles
- Permalinks for view state

**Acceptance:**

- Toggle keeps center/fov/epoch
- Deep link reconstructs state identically

### Stage 4 — Mode A (Aladin) Integrated + Snapshot Capability

**Deliverables:**

- Mode A viewer loads MedianStack by default
- Client snapshot: export a PNG (at least local; later server artifact)
- Audits "viewer opened" / "state changed" events

**Acceptance:**

- Mode A works reliably and can snapshot

### Stage 5 — Mode B "Bones": Manifest + Canvas Renderer

**Deliverables:**

- `/view/manifest` implemented (Nest → Go → Nest)
- Canvas viewer renders tiles based on manifest
- Overlay interfaces exist (grid, points) even if minimal

**Acceptance:**

- Mode B pans/zooms and draws tiles
- Projection is "good enough," architecture allows swap-in improved mapping later

### Stage 6 — Proxy/Cache Engine + Preview Compositor Hardened

**Deliverables:**

- Controlled proxy endpoints: allowlist-only, no open proxy, TTL/size caps, anti-crawl detection
- Preview compositor generates deterministic small PNGs for SSR
- Artifacts stored in filesystem (storage driver interface) with metadata and hashes

**Acceptance:**

- Golden image tests pass
- Cache stats visible in Admin ops
- Anti-crawl triggers appropriately and is audited

### Stage 7 — Community v1 (Public Read, Verified Write)

**Deliverables:**

- Community feed + post page SSR
- Post editor supports: Markdown + images, embedded viewer blocks, curated tags block
- Publish creates: Post rev1, snapshot artifact, public read URL
- Comments (verified only)
- Full revision history

**Acceptance:**

- Public can read
- Verified can publish/comment
- Revisions immutable; each edit creates new revision

### Stage 8 — Curated Tags Governance + Moderation Tools

**Deliverables:**

- Curated tag registry
- Power proposes tags → Moderator approves
- Mod queue: reports, pending tag proposals
- Actions: hide/unhide, lock/unlock comments, tag "needs sources"
- 90-day audit retention job

**Acceptance:**

- Every mod action audited with corrId
- Tag taxonomy controlled and consistent

## Code Collection: Types, Models, and Key Snippets

Detailed code examples follow in sections below including TypeScript DTOs, Angular patterns, NestJS implementations, Go service stubs, SQL schemas, and environment variables.

## Operational Expectations & Governance

### CI/CD Gates

Tie every change to CI gates that enforce:

- `pnpm nx lint` (all packages)
- `pnpm nx test` (unit tests)
- `pnpm nx build` (compilation)
- `pnpm nx e2e` (end-to-end tests when defined)

These gates ensure DTO contracts, guardrails, typing, and formatting stay enforced.

### Metrics & Documentation

- Document key metrics in `documentation/METRICS.md`:
  - Viewer latency (HiPS load time, canvas render time)
  - Cache hit ratio and storage utilization
  - Guardrail pass rate (allowlist enforcement)
  - Audit retention (90-day cleanup job)
  - Rate limit violations
  - Anti-crawl triggers
- Add onboarding references to promote monitoring and alerts.

### Dataset & Artifact Governance

Treat dataset versioning, licensing metadata, and guardrail updates as governed artifacts:

- Link all upstream endpoint changes to approvals and change logs
- Provide data source owners with a release checklist
- Record artifact checksums (SHA256) in audit events
- Track snapshot artifacts with provenance metadata

### Security & Audit

Keep security, legal, and ethics assessments explicit:

- Document in `SECURITY.md`
- Maintain a dedicated governance log
- Ensure political alignment strategy remains auditable
- Include alerts for metric breaches:
  - Latency thresholds
  - Guardrail failure rate
  - Cache eviction anomalies

### Audit Focus

Priority audits:

- **Call/response telemetry**: Correlation IDs across HTTP + WebSocket
- **DTO validation per transport**: Enum/type mismatches on payload boundaries
- **Content filtering**: Illegal content detection, takedown logging, anonymous user tracking
- **Dataset provenance**: Upstream source, epoch, Quick Look vs. HiPS tier
- **Artifact traceability**: Snapshot generation chain, SHA256 verification
- **Rate limit enforcement**: Per-user, per-IP, per-role tracking
- **Anonymized violations**: Log violations without PII for review and trend analysis

### Onboarding Checklist

New developers should:

1. Clone the repo: `git clone ...`
2. Install dependencies: `pnpm install` (installs Husky hooks via `prepare`)
3. Run baseline checks locally:
   - `pnpm run lint` (fast ESLint)
   - `pnpm run lint:typed` (full typed ESLint — if defined)
   - `pnpm nx test` (unit tests)
   - `pnpm nx build` (compilation)
4. Read `documentation/guides/OVERVIEW.md` for architectural context
5. Read this guide for standards and Stage-based delivery
6. Check `SECURITY.md` and `GOVERNANCE.md` for audit and approval workflows

### Exception Process

If a PR requires a typing or enforcement exception:

1. Add a **Exception** section in the PR description explaining:
   - Why the exception is needed
   - How long it will last (e.g., "through Stage 2")
2. Tag an approver from `CODEOWNERS`
3. Add an entry to `documentation/GOVERNANCE.md` with:
   - PR link
   - Rationale
   - Owner and expiry date
4. Aim to correct exceptions before merging to `main` when possible

### Version Control & Hygiene

- Enforce branch protection: `main` requires passing CI + code review
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Link PRs to GitHub Issues (tracker or GitHub Issues)
- Require a reviewers from `CODEOWNERS` on any change to:
  - `libs/shared/models/*` (DTO contracts)
  - `libs/server/*` (policy/guardrails)
  - `.env*` templates (configuration)
  - `tools/policy-tests/*` (enforcement rules)
  - `/documentation/*` (standards & governance)

---

**Last Updated:** 2026-02-06  
**Applicable to:** VLASS Sky Portal (Nx 20, Angular 19, NestJS)  
**Based on:** Craft Fusion Enterprise Standards + VLASS-Specific Additions
