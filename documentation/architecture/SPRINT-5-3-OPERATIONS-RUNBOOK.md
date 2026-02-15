# Sprint 5.3 Operations Runbook

Status date: 2026-02-15
Scope: Week 3 production-readiness checks, event replay operations, and docs-view catalog operations.

## 1. Startup and Preflight

Run full local stack:

```bash
pnpm start:all
```

What now runs automatically:

- `start:preflight` executes runtime checks and `pnpm docs:view:build`
- docs catalog is regenerated from markdown source files before app serve starts

## 2. Documentation View Operations

Source of truth:

- `documentation/**/*.md`
- root docs: `README.md`, `ROADMAP.md`, `TODO.md`

Build catalog manually:

```bash
pnpm docs:view:build
```

Validate docs consistency (also rebuilds catalog first):

```bash
pnpm nx run docs-policy:check
```

API endpoints used by the docs UI:

- `GET /api/internal-docs/catalog`
- `GET /api/internal-docs/content/:docId`

Operational rule: do not rewrite docs pages in web code; render markdown loaded via these APIs.

## 3. Event Replay Operations

Replay/offset API surface:

- `GET /api/events/topics`
- `GET /api/events/history?topic=<topic>&sinceTimestamp=<ISO>&fromOffset=<n>&limit=<n>`
- `GET /api/events/offsets?groupId=<group>`
- `POST /api/events/offsets/ack`

Example replay request:

```bash
curl "http://localhost:3000/api/events/history?topic=job-lifecycle&limit=100"
```

Example consumer offset ack:

```bash
curl -X POST "http://localhost:3000/api/events/offsets/ack" \
  -H "Content-Type: application/json" \
  -d '{"groupId":"metrics-consumer-group","topic":"job-metrics","partition":0,"offset":42}'
```

Current storage model:

- In-memory replay cache per topic (max 5000 records/topic)
- In-memory consumer offsets by `groupId:topic:partition`
- Replay state resets on service restart

## 4. Production-Readiness Checks

Minimum Week 3 verification set:

```bash
pnpm docs:view:build
pnpm nx run docs-policy:check
pnpm nx run cosmic-horizons-web:test --skip-nx-cache
pnpm nx run cosmic-horizons-api:test -- --runTestsByPath src/app/app.controller.spec.ts src/app/modules/events/test/kafka.service.spec.ts src/app/modules/events/test/e2e-workflow.spec.ts src/app/modules/events/test/error-scenarios.spec.ts src/app/modules/events/test/integration.spec.ts src/app/modules/events/test/performance.spec.ts
```

Notes:

- Full API test target may run long in this environment; use targeted Week 3 suite above for release gating until full-suite timing is stabilized.
- If docs do not appear in `/docs`, run `pnpm docs:view:build` and restart API.

## 5. Incident Triage Quick Steps

If docs page is empty:

1. `pnpm docs:view:build`
2. Verify `documentation/index/DOCS-VIEW-CATALOG.json` exists
3. Check `GET /api/internal-docs/catalog`

If replay history is empty unexpectedly:

1. Confirm events are being published after current process start
2. Check `GET /api/events/topics`
3. Check `GET /api/events/offsets`
4. Remember replay cache is in-memory and cleared on restart
