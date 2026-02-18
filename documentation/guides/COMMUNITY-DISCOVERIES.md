# Community Discoveries (Prototype)

Short summary
- The Community Discoveries prototype is now persisted (Postgres + TypeORM), seeded in development, publishes notification events, and has unit + e2e coverage.

Purpose
- Lightweight feed for short community posts (tags, links, short descriptions).
- Prototype provides persistence, eventing for UI toasts, and basic API surface to validate integration and event paths.

Key implementation points (developer)
- Backend entity: `Discovery` — `apps/cosmic-horizons-api/src/app/entities/discovery.entity.ts`
  - Fields: `id: uuid`, `title`, `body`, `author`, `tags: jsonb`, `created_at: timestamp`
- Migration + seeds: `apps/cosmic-horizons-api/src/migrations/20260217CreateDiscoveriesTable.ts`
- Service: `CommunityService` (TypeORM-backed) — `apps/cosmic-horizons-api/src/app/modules/community/community.service.ts`
  - `getFeed(limit)` uses `discoveryRepo.find({ order: { created_at: 'DESC' }, take: limit })`
  - `createDiscovery(dto)` persists entity and publishes `community.discovery.created` via `EventsService`
- Controller: `CommunityController` — `apps/cosmic-horizons-api/src/app/modules/community/community.controller.ts`
  - Routes: `GET /api/community/feed`, `POST /api/community/posts`
- Event published: `community.discovery.created` (EventBase payload contains `discovery_id`, `title`, `author`)
  - RabbitMQ routing: `websocket-broadcast` queue (notifications exchange)

Frontend
- Components: `CommunityFeed`, `CommunityComposer` — `apps/cosmic-horizons-web/src/app/features/community`
- Service: `CommunityApiService` calls `GET /api/community/feed` and `POST /api/community/posts`
- UI behaviour: on createDiscovery, backend publishes notification; UI subscribes via websocket to show toasts.

Tests
- Unit tests: `apps/cosmic-horizons-api/src/app/modules/community/community.service.spec.ts`
- E2E tests: `apps/cosmic-horizons-api-e2e/src/community.e2e-spec.ts`
  - Includes assertion that a RabbitMQ message appears on `websocket-broadcast` when a discovery is created.

How to run locally
1. Start infra + apps: `pnpm start:all`
2. Verify seeded feed: `GET http://localhost:3000/api/community/feed` (should return seeded rows)
3. Create a post (example `curl`):

```bash
curl -X POST http://localhost:3000/api/community/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"hello","body":"world","author":"dev","tags":["test"]}'
```

4. Observe RabbitMQ notification (dev-only) on queue `websocket-broadcast` (see e2e for example consumer code)

Developer notes / PR checklist
- Add or update unit tests when changing `Discovery` fields or mapping.
- If altering event payload, update `EventModels` types in `libs/shared/event-models`.
- Add Playwright acceptance tests for toast notifications when enabling production websocket behaviour.

Remaining work (suggested)
- Moderation + auth gating for production posting (feature flag).  
- Frontend acceptance tests for toast UX (Playwright).  
- Admin moderation UI (hide/remove posts, reporting).  

Reference files
- API: `apps/cosmic-horizons-api/src/app/modules/community/*`  
- Entity: `apps/cosmic-horizons-api/src/app/entities/discovery.entity.ts`  
- Migration: `apps/cosmic-horizons-api/src/migrations/20260217CreateDiscoveriesTable.ts`  
- E2E: `apps/cosmic-horizons-api-e2e/src/community.e2e-spec.ts`  

Changelog note (v1.1 candidate)
- Community Discoveries: persisted DB-backed prototype with seeded demo data and notification events (RabbitMQ). Unit + e2e coverage added.
