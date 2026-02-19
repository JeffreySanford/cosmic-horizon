# Coding Standards (MVP)

Status date: 2026-02-07
Canonical scope: `documentation/product/PRODUCT-CHARTER.md` + `SCOPE-LOCK.md`.

## Core Rules

- Nx-first task execution

- Keep TypeScript strict and testable

- Prefer simple module boundaries

- Keep docs consistent with `libs/shared/models` contracts

- Favor RxJS observables (hot/live streams) over ad-hoc Promises for UI + service flows; keep request/stream lifecycles explicit.

- Angular module-mode policy: all `@Component` and `@Directive` declarations must explicitly set `standalone: false` (enforced by `pnpm standalone:check`).

## MVP Boundaries in Code

- Viewer Mode A only

- No Go service integration

- No FITS proxy code paths

- Comments/profile extensions may exist, but Pillar 1/2 behavior and performance gates must remain green

## Deferred Work Handling

## If implementing v1.1/v2 work (comments, Mode B, FITS proxy), gate with explicit roadmap updates first

---

_Cosmic Horizon Development - (c) 2026 Jeffrey Sanford. All rights reserved._
