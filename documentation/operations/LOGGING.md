# Logging & Observability

Status date: 2026-02-08

## Goals
- Capture end-to-end interactions (web ↔ API, API ↔ PostgreSQL/Redis, external providers, websockets/health) with correlation IDs.
- Keep sensitive data out of logs; payload sizes are recorded, not bodies.
- Deliver live operator visibility in `/logs` with filterable, sortable entries.

## Sources
- **Frontend (Angular)**: `AppLoggerService` collects UI/system events; HTTP interceptor logs method, URL, status, duration, request/response byte counts, correlation ID `272762e810cea2de53a2f`, and user metadata when available.
- **API (NestJS)**: `RequestLoggerInterceptor` logs every request/response with status, duration, bytes, user metadata, and correlation ID.
- **Viewer service**: Redis/memory cache hits/misses/sets/errors with byte size and TTL; external cutout fetch attempts and failures.
- **Health/WebSocket**: health check pings and gateway events are logged at `info` level with sizes where applicable.

## Storage & Retention
- Default: in-memory ring buffer sized for local admin debugging.
- Optional: Redis list for cross-node durability (enabled when Redis is configured).
- Runtime artifacts only; `*.log` files are ignored from version control.

## API Surface
- `GET /api/admin/logs?offset=&limit=` — paged log feed for the admin UI.
- `GET /api/admin/logs/summary` — counts by level for the filter tiles.
- Response type: `HttpResponse<Log>` where `Log` includes:
  - `id`, `at`, `level`, `area`, `event`, `message?`
  - `status?`, `duration_ms?`
  - `request_bytes?`, `response_bytes?`
  - `user_id?`, `user_role?`
  - `correlation_id?`

## UI Behavior (`/logs`)
- Material table with live hot stream, column sorting, and level-based row shading.
- Five filter tiles (All, Verbose, Info, Warnings, Errors) with counts right-aligned; clicking filters the table.
- Colors of tiles match the shaded rows for quick scanning.

## Guardrails
- `.env*.local` and runtime log files stay local and are gitignored.
- Avoid logging secrets or large payload bodies; prefer sizes and IDs.
- Correlation ID is constant for now (`272762e810cea2de53a2f`) and should become a per-request value in future work.
