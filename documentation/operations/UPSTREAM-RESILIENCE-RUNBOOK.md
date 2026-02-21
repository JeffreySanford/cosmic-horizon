# Upstream Dependency Resilience Runbook

This document captures the assumptions, timeout values, retry/backoff behavior, and ordered fallbacks for the various external astronomy datasets and services used by Cosmic Horizons. It is intended as a quick reference for on‑call engineers and reviewers.

## Scope

- Viewer pipeline upstreams (cutouts, labels, snapshots)
- Ephemeris providers (JPL Horizons, NASA SPICE, etc.)
- Catalog sources (SIMBAD/TAP)

## Provider List & Fallback Order

1. **Primary survey storage**: the pre‑computed cutout/snapshot CDN introduced during Phase 3. Fallback: recompute from raw survey tiles if unavailable.
2. **SIMBAD TAP service** (nearby object labels). Fallback: return empty label set with warning logged; client renders without overlays.
3. **JPL Horizons REST API** (ephemeris). Fallback: use cached ephemeris for last 24 h; if none, return failure message to user and log a high‑severity alert.
4. **Secondary catalog sources** (e.g. VizieR) — used only during batch ingestion; failures are logged and retried off‑peak.

## Timeouts & Retries

- All upstream HTTP calls use a default 10‑second timeout configured via `env` or hardcoded constant (`DEFAULT_UPSTREAM_TIMEOUT_MS`).
- Retry policy: 3 attempts with exponential backoff (200 ms → 400 ms → 800 ms) for idempotent GET requests. Backoff parameters are defined in `apps/cosmic-horizons-api/src/app/config/upstream.config.ts`.
- Client‑facing requests do **not** wait for retries: any upstream error after the first attempt is considered a cache miss and the response is constructed accordingly.

## Cache TTL Rationale

- **Viewer cutouts/snapshots**: 1 hour TTL in Redis to balance between stale data and burst protection during surveys. Cached by the same key as the request fingerprint.
- **SIMBAD label queries**: 24‑hour TTL; labels change infrequently and the service is rate‑limited. Configurable via `EPHEMERIS_CACHE_TTL_HOURS` where appropriate.
- **Ephemeris calculations**: results are precalculated for all known bodies and stored with 24‑hour TTL; cache key includes epoch timestamp.

## Monitoring & Alerts

- Persistent upstream failures (3+ sequential timeouts or HTTP 5xx) trigger an alert via the existing `TelemetryService.notifyUpstreamFailure()` hook.
- Metrics (`upstream.success`, `upstream.error`, `upstream.latency`) are exported to Prometheus with an `upstream` label indicating the service.

## Troubleshooting Checklist

1. Check application logs for `SIMBAD nearby-label query failed` or `JPL Horizons timeout` messages. Copy correlation ID to support ticket.
2. Verify Redis cache hit ratio on the relevant key namespace (e.g. `viewer:labels:*`).
3. If the upstream service is down, consult the provider status pages:
   - SIMBAD: <https://cds.u-strasbg.fr/status>
   - JPL Horizons: <https://ssd.jpl.nasa.gov/horizons.cgi>
4. For persistent failures, adjust timeout/backoff parameters in `upstream.config.ts` and redeploy.

---

_Document last updated: 2026‑02‑20._
