# NgRx Implementation and Migration Plan

## Execution checklist (updated 2026-02-21)

- [x] Phase 0 foundation implemented (`@ngrx/*` dependencies, root store/effects/router-store/devtools, runtime checks).
- [x] Phase 1 auth/session/global UI migration implemented (auth + mock mode store-backed paths with compatibility fallbacks).
- [x] Phase 2 jobs + real-time updates migration implemented (`@ngrx/entity` jobs slice, polling/effects, websocket bridge).
- [x] Phase 3 alerts/logs/telemetry migration implemented (feature slices + effects + selector-driven service APIs).
- [x] Phase 4 ephemeris migration implemented (store-backed calculating/result/support-object state + cache integration).
- [x] Phase 5 router-store enabled and wired.
- [x] Phase 6 component-store review completed (no immediate mandatory local-complexity candidates moved yet).
- [x] Phase 7 second-pass hardening completed (compatibility shims removed, typed store injections, pure store-backed tests).
- [x] Angular scope processed.
- [x] NestJS scope reviewed: NgRx is not applicable to NestJS runtime state in this repo (no server-side NgRx migration required).

## Validation status

- [x] `pnpm nx run cosmic-horizons-web:test --skip-nx-cache` passed.
- [x] `pnpm nx run cosmic-horizons-web:lint` passed.
- [x] `pnpm nx run cosmic-horizons-web:build` passed (2026-02-21) after SSR builder config adjustment; warnings remain for bundle/style budgets and CommonJS deps.

## Second-pass completion notes (2026-02-21)

- Removed optional-store compatibility shims from migrated Angular services and root app component.
- Tightened store typing to `Store<AppState>` in the migrated services.
- Converted affected Vitests to pure store mocks (`provideMockStore`) instead of legacy local subject shims.
- Added/updated service tests for store-dispatch + selector behavior (alerts, telemetry/performance, ephemeris, job orchestration).

## Current status (as of 2026-02-21)

Short answer: this codebase is **now using NgRx across Angular state domains in scope**.

Evidence from workspace scan:

- `@ngrx/store`, `@ngrx/effects`, `@ngrx/entity`, `@ngrx/router-store`, `@ngrx/store-devtools` are present in `package.json`.
- Root NgRx wiring is active in `apps/cosmic-horizons-web/src/app/app-module.ts`.
- Root reducers include router reducer in `apps/cosmic-horizons-web/src/app/store/app.reducer.ts`.
- Feature actions/reducers/effects/selectors are present for `auth`, `ui`, `jobs`, `alerts`, `logs`, `telemetry`, `ephemeris`.
- `@ngrx/entity` is active for jobs collection state in `apps/cosmic-horizons-web/src/app/store/features/jobs/jobs.reducer.ts`.
- Router selectors are present in `apps/cosmic-horizons-web/src/app/store/router/router.selectors.ts`.
- Service + component tests use `provideMockStore` instead of legacy compatibility state shims.

## Why we migrated

Given Cosmic Horizons' real-time telemetry, job orchestration, and auditability requirements, NgRx provides:

- Predictable state transitions (reducers).
- Explicit event model (actions) for traceability.
- Clean async orchestration (effects).
- Scalable, memoized read paths (selectors).
- Better collection management for streaming updates (`@ngrx/entity`).
- Router-linked state and replay/debugging support.

## Target architecture

Create a root app state with feature slices:

```ts
interface AppState {
  auth: AuthState;
  ui: UiState;
  jobs: JobsState;
  messaging: MessagingState;
  telemetry: TelemetryState;
  alerts: AlertsState;
  logs: LogsState;
  ephemeris: EphemerisState;
  router: RouterReducerState;
}
```

Use this split:

- `Store`: cross-route, business-critical state.
- `ComponentStore`: local widget/page state that does not need global visibility.
- Plain service state: ephemeral implementation details only (rare).

## Proposed Nx folder conventions

Under `apps/cosmic-horizons-web/src/app`:

- `store/`
- `store/app.state.ts`
- `store/app.reducer.ts`
- `store/meta-reducers/`
- `store/core.actions.ts`
- `store/router/`
- `features/<feature>/state/` for feature slices (`actions.ts`, `reducer.ts`, `effects.ts`, `selectors.ts`, `models.ts`)

Optional (preferred as migration grows): move state into `libs/web/state/*` for stronger boundaries.

## Phased migration plan (completed)

## Phase 0: Foundation

1. Add dependencies.
2. Register root store/effects/router-store/devtools.
3. Enable runtime checks and strict serializability rules.
4. Add a tiny core slice (`ui` or `app`) to validate wiring.

Install:

```bash
pnpm add @ngrx/store @ngrx/effects @ngrx/entity @ngrx/router-store @ngrx/store-devtools
```

Wire in `AppModule` (`apps/cosmic-horizons-web/src/app/app-module.ts`):

- `StoreModule.forRoot(...)`
- `EffectsModule.forRoot([...])`
- `StoreRouterConnectingModule.forRoot()`
- `StoreDevtoolsModule.instrument(...)` for dev only

## Phase 1: Auth + Session + Global UI

Migrate from ad hoc session checks to store-backed auth session model.

Primary files:

- `apps/cosmic-horizons-web/src/app/services/auth-session.service.ts`
- `apps/cosmic-horizons-web/src/app/features/auth/*`
- `apps/cosmic-horizons-web/src/app/guards/auth.guard.ts`
- `apps/cosmic-horizons-web/src/app/guards/admin.guard.ts`

Actions examples:

- `authLoginRequested`, `authLoginSucceeded`, `authLoginFailed`
- `authRestoreSessionRequested`, `authLogoutRequested`, `authLogoutCompleted`
- `authRoleEvaluated`

Effects:

- login/logout API calls.
- bootstrap session restore from storage.

Notes:

- Keep token storage logic in a dedicated adapter service invoked by effects.
- Guards should consume selectors, not call parsing logic directly.

## Phase 2: Jobs and Real-time updates (highest value)

Migrate job orchestration to normalized entity state.

Primary files:

- `apps/cosmic-horizons-web/src/app/features/job-orchestration/job-orchestration.service.ts`
- `apps/cosmic-horizons-web/src/app/services/messaging.service.ts`
- `apps/cosmic-horizons-web/src/app/features/job-orchestration/*`
- `apps/cosmic-horizons-web/src/app/modules/operations/job-dashboard/*`

NgRx shape:

- `jobs` slice uses `createEntityAdapter<Job>()`.
- Track `selectedJobId`, `loading`, `error`, and progress series derivations.

Actions examples:

- `jobsLoadRequested/succeeded/failed`
- `jobSubmitted/succeeded/failed`
- `jobUpdateReceived` (from websocket/SSE)
- `jobCancelled/succeeded/failed`

Effects:

- API polling/refresh.
- websocket/SSE bridge (`MessagingService`) dispatching update actions.

## Phase 3: Alerts, Logs, and Telemetry

Move operational streams from service subjects into feature stores.

Primary files:

- `apps/cosmic-horizons-web/src/app/features/alerts/alerts.service.ts`
- `apps/cosmic-horizons-web/src/app/services/app-logger.service.ts`
- `apps/cosmic-horizons-web/src/app/services/performance-data.service.ts`
- `apps/cosmic-horizons-web/src/app/features/logs/logs.component.ts`

Approach:

- `alerts` slice: polling effect + selector-driven presentation.
- `logs` slice: append/truncate reducer policy and filtering selectors.
- `telemetry` slice: normalized live stream summaries + derived selectors.

Use `@ngrx/entity` where IDs exist and updates are incremental.

## Phase 4: Ephemeris and cache policy

Primary files:

- `apps/cosmic-horizons-web/src/app/services/ephemeris.service.ts`
- `apps/cosmic-horizons-web/src/app/features/ephemeris/*`

Approach:

- Store request/result state in NgRx.
- Keep TTL cache implementation in a small service, invoked by effects.
- Add selectors for `calculating`, cache status, and last resolved object.

## Phase 5: Router-store and auditability hardening

Primary files:

- `apps/cosmic-horizons-web/src/app/app.routes.ts`
- `apps/cosmic-horizons-web/src/app/app.ts`

Add:

- `@ngrx/router-store` selectors for route-driven context.
- Optional navigation effects for route-state workflows.
- Devtools action/state sanitizers if sensitive fields appear.

## Phase 6: ComponentStore adoption for local complexity

Use `ComponentStore` for component-local, non-global state (complex widgets/forms):

- viewer interaction-only UI state.
- transient filter editors.
- local draft/edit forms.

Rule: if multiple routes or services depend on it, promote to global Store.

## Migration map: current service state to NgRx

- `JobOrchestrationService.jobsSubject` -> `jobs` entity slice.
- `JobOrchestrationService.progressSeriesSubject` -> derived `jobs` selectors.
- `PerformanceDataService.historySubject/gpuHistorySubject/selectedIndexSubject` -> `telemetry` slice (+ selectors).
- `AlertsService.alertsSubject` -> `alerts` slice.
- `AppLoggerService.entriesSubject` -> `logs` slice.
- `MockModeService._mock$` -> `ui` or `runtime` slice.
- `MessagingService` subjects -> effect-driven action stream + store updates.
- `EphemerisService.calculatingSubject` -> `ephemeris` slice.

## Test strategy during migration

1. Reducer unit tests for every state transition.
2. Effects tests with mocked services and scheduler-driven observables.
3. Selector tests for memoization and derived values.
4. Existing component tests updated to mock selectors instead of service subjects.

Run with Nx:

```bash
pnpm nx run cosmic-horizons-web:test
pnpm nx run cosmic-horizons-web:lint
pnpm nx run-many --target=test --projects=cosmic-horizons-web,cosmic-horizons-api
```

## Rollout guardrails

- Migrate one feature slice at a time; avoid big-bang rewrite.
- Keep compatibility facades while components are being moved.
- Do not duplicate authority: each state domain has one source of truth.
- Keep actions event-oriented (`thingHappened`) rather than command-heavy.
- Prefer selectors over inline `store.select((s) => ...)` in components.

## Definition of done for "full NgRx" in this repo

- Root store configured with runtime checks.
- Effects orchestrate all async reads/writes for migrated domains.
- Jobs, telemetry, alerts, logs, auth, ephemeris are store-backed.
- Router-store enabled for route-sensitive dashboards.
- Entity adapter used for high-churn collections.
- Devtools enabled in development.
- Remaining local-only complexity managed with `ComponentStore`.

## Practical answer

You are already on NgRx for the Angular app state domains targeted in this plan.

The migration plan has been completed and this document now serves as the completion and validation record.
