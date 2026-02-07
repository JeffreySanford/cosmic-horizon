# Environment Configuration (MVP)

Status date: 2026-02-07

## Principles
- Server-only secrets stay in API environment variables.
- Client receives only sanitized config from `GET /config/public`.
- Public VLASS endpoints only; link-out for FITS.

## Required Core Variables
- `NODE_ENV`
- `PORT`
- `JWT_SECRET`
- `DB_URL`
- `VLASS_HIPS_BASE`
- `VLASS_QUICKLOOK_BASE`
- `UPSTREAM_ALLOWLIST`
- `AUDIT_RETENTION_DAYS`
- `RATE_ANON_RPM`
- `RATE_VERIFIED_RPM`

## Deferred Feature Flags
- Mode B toggles (v2)
- FITS proxy toggles (v2)
- Comment feature flags (v1.1)

If config docs conflict with runtime code, source of truth is active code + charter/scope lock.
