# SSR Strategy (MVP)

Status date: 2026-02-07

## Goal
Deliver fast first paint and stable SEO-rendered pages.

## MVP SSR Targets
- Landing page SSR with fast initial render
- Feed/post detail SSR for discoverability
- FCP/LCP targets per product charter

## Official Metric Source

SSR KPI reporting is standardized on Lighthouse CI:

```bash
pnpm nx run vlass-web:lighthouse
```

Reports are written to `test-output/lighthouse` and are the official source for
FCP/LCP tracking.

## Deferred
- Mode B fallback logic in SSR paths
- Rendering flows that depend on Go/FITS proxy

## Source of Truth
- `documentation/PRODUCT-CHARTER.md`
- `SCOPE-LOCK.md`
