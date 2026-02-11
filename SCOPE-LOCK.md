# VLASS Sky Portal — MVP Scope Lock

> Affiliation note: this is an independent portfolio/community project using public VLASS data and is not an official VLA/NRAO deliverable.

**Date:** 2026-02-07  
**Status:** LOCKED (No re-litigating)

---

## What Changed Today

### ✅ Removed

- **Go microservice** (`apps/vlass-go/`): Deleted entirely
- **Full FITS proxy/caching architecture**: Deferred; MVP allows only constrained cutout passthrough + link-out
- **Two-tier audit retention**: Simplified to 90-day hot only (ADR-001)
- **Mode B (Canvas viewer)**: Deferred; Aladin only for MVP (ADR-004 simplified)
- **Scope creep risks**: Locked 3-pillar MVP with PRODUCT-CHARTER.md

### ✅ Updated

| File                                        | Change                                               |
| ------------------------------------------- | ---------------------------------------------------- |
| `documentation/adr/ADR-001-*.md`            | 90d hot only (no 2yr cold)                           |
| `documentation/adr/ADR-002-*.md`            | Link-out (Option A, no NRAO approval blocker)        |
| `documentation/adr/ADR-003-*.md`            | Rust for rendering only, not compute                 |
| `documentation/product/PRODUCT-CHARTER.md`  | **Created** — MVP scope + success metrics            |
| `documentation/backend/CACHE-POLICY.md`     | Removed Go tier; NestJS + browser only               |
| `documentation/operations/QUICK-START.md`   | Removed Terminal 3 (Go); marked Rust optional        |
| `documentation/quality/TESTING-STRATEGY.md` | Replaced "contract tests" with API integration tests |

### 📋 Three Pillars (Locked)

1. **SSR First Paint** — personalized landing page background (<1s load)
2. **Viewer + Permalinks** — Aladin + viewer state serialization + snapshots
3. **Community Notebook** — markdown + embedded viewer blocks + revisions

### 🚫 Not in MVP

- Full FITS proxy / caching
- Mode B (Canvas) viewer
- Comments / replies (originally deferred in MVP lock; later added as post-MVP extension)
- User profiles (originally deferred in MVP lock; later added as post-MVP extension)
- Any Rust code (deferred)

---

## Current State

**The repository is now:** Clean, focused, and unambiguous.

**Team knows:**

- ✅ What "done" means (3 pillars complete, metrics met)
- ✅ What "not done" means (deferred to v1.1/v2)
- ✅ No mirror/proxy archive dependency
- ✅ No Go knowledge required
- ✅ Technology: Angular + NestJS only for MVP

---

## Next Steps for Rust (If Needed Later)

If you decide to add Rust for advanced rendering (v2+):

1. Create `apps/vlass-rust/` directory
2. Initialize Cargo project
3. Implement preview + snapshot rendering (from ADR-003)
4. Add Rust tests to CI pipeline
5. Update TESTING-STRATEGY.md with Rust test patterns

For now: **Rust is future-proofed but not required.**

---

## Question for You

Beyond removing Go and simplifying FITS:

1. **Do you want to delete VIEWER-MODE-B.md now**, or keep it as "deferred v2" documentation?
2. **Do you want a simplified README.md** that explains the MVP in 1 sentence + 3 pillars?

Let me know, or we're done! 🚀
