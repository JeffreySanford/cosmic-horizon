# SSR Strategy (MVP)

Status date: 2026-02-07

## Goal

Deliver fast first paint and stable SEO-rendered pages.

## MVP SSR Targets

- Auth (`/auth/login`) and landing (`/landing`) SSR render with stable first paint

- Client hydration without blocking interaction

- Dynamic telemetry overlay rendered client-side (time/region/lat-lon)

- FCP/LCP targets per product charter

## Official Metric Source

SSR KPI reporting is tracked using product KPIs and operational monitoring for
FCP/LCP and first-render reliability.

## Deferred

- Feed/post detail SSR expansion

- Mode B fallback logic in SSR paths

- Rendering flows that depend on Go/FITS proxy

## Source of Truth

- `documentation/product/PRODUCT-CHARTER.md`

## - `SCOPE-LOCK.md`
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
