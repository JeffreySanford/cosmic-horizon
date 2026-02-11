# VLASS Sky Portal — MVP Product Charter

**Date:** 2026-02-07
**Status:** ACTIVE
**Owner:** You (portfolio + community)
**Audience:** Internal (team alignment only)

---

## One-Line Product Definition

> **Fast VLASS sky browser + shareable permalinks + research notebook posts + snapshots (+ constrained FITS cutout download).**

It's a **collaboration + publishing layer** on top of VLASS data, not an archive tool or FITS redistribution service.

It is an independent project and not an official VLA/NRAO/VLASS product.

External ecosystem alignment (planning context): The portal is designed to be integration-ready with future AI/compute backends while remaining institution-independent unless a formal partnership is established.

---

## Three Pillars (MVP Only)

### Pillar 1: Instant SSR First Paint (Wow Factor)

**Goal:** Users land on site and see a beautiful, personalized VLASS preview in under 1 second.

**Scope:**

- Landing page SSR includes regional VLASS preview PNG

- Location is opt-in and coarse (precision 4 geohash = ~5km)

- Viewer loads on client; SSR never tries to execute viewer logic

- First paint optimized for mobile + desktop

**Success Metric:** FCP <1s on 4G, LCP <2s

**What's NOT Included:**

- Mode B (Canvas viewer) — deferred; Aladin only for MVP

- WCS reprojection — deferred

- Full FITS proxy/caching — deferred

---

### Pillar 2: Viewer + Permalinks + Snapshots

**Goal:** Users can explore the sky, share exact views with friends, and capture permanent snapshots.

**Scope:**

- Aladin viewer (Mode A only) with zoom/pan

- ViewerState as a first-class object: `/view?state=<encoded>` or `/view/<shortid>`

- Snapshot button: "Save PNG" → stores artifact (filesystem for MVP)

- Full viewer state serializable + deserializable

- Constrained FITS cutout passthrough endpoint for centered state export (rate-limited, audited, no mirror caching)

**Success Metric:** Permalink works 100% of time; snapshot artifact persists >7 days

**What's NOT Included:**

- Mode B fallback — Aladin is primary and only for MVP

- Server-side snapshot rendering — client-side PNG download only

- Dynamic rendering (GIF, video) — PNG snapshots only

- Full FITS proxy/caching, arbitrary upstream mirroring, or archive behavior

---

### Pillar 3: Community Research Notebook (Real Product)

**Goal:** Users publish markdown + embedded viewer blocks, share analysis, discuss, iterate with revisions.

**Scope:**

- Post editor: Markdown with embedded `\`\`\`viewer { ... }\`\`\`` blocks

- On publish: parse blocks, auto-snapshot, create revision 1

- On edit: create revision N; show diff

- Public read, verified write; basic moderation (hide/lock)

- Tag system: user suggests, mod approves

- Feed view + post detail (SSR both)

**Success Metric:** 5+ posts published; users re-edit their posts at least once

**What's NOT Included:**

- Comments/replies (future arc)

- Post permissions (make all public for MVP)

- Advanced roles (power users can propose, but no special UI yet)

- Notification system — users check feed manually

---

## Explicit Non-Scope (MVP)

### What We're NOT Building

**FITS Proxy/Caching Tier** (v2 if users demand)

Full proxy/cache/mirroring is deferred; constrained cutout passthrough only in MVP

**Mode B Viewer** (v2 if Aladin fails)

Canvas/Paper.js is v2; Aladin is plenty for MVP

**WCS Reprojection** (v2+)

Compute-heavy; clients can download + reproject locally

**FITS Generation** (v2+)

(same as proxy; out of scope)

**Comment System** (v1.1)

Good first v1.1 feature, but not MVP

**Team/Org Features** (v2+)

Collaborative viewing can wait

**Mobile App** (v2+)

Web-only for MVP

**User Profiles** (v2+)

Focus on posts, not bios

**Advanced Search** (v2+)

Tag-based discovery suffices

**API/SDK** (v2+)

Ship web app first; public API later

---

## Technology Stack (Locked for MVP)

| Layer              | Tech                                               | Why                                        |
| ------------------ | -------------------------------------------------- | ------------------------------------------ |

| **Frontend**       | Angular 18 + Material 3 + SSR                      | Know it well; SSR is key to UX             |

| **Backend**        | NestJS + Postgres + Redis                          | Proven, maintainable, team familiar        |

| **Render Service** | Rust (sidecar) for PNG composition                 | Fast image rendering (preview + snapshot)  |

| **Viewer A**       | Aladin Lite (CDN)                                  | Ready-made, proven, no custom build        |

| **Viewer B**       | (Deferred)                                         | Not in MVP                                 |

| **Cache**          | Redis + local PVC                                  | Simple, no cost for preview artifacts      |

| **Persistence**    | Postgres (posts, revisions, tags) + S3 (artifacts) | Standard; play-it-safe for MVP             |

| **Async Jobs**     | Bull (Redis queue)                                 | Snapshot rendering jobs                    |

| **Deploy**         | Kubernetes + Helm                                  | Standard deployment path for scalability   |

---

## User Personas (MVP)

### Primary: Hobbyist + Community Member

- Browses VLASS casually (no login required for viewing)

- Verifies email to post

- Publishes one "cool thing I found" post per month

- Shares links with friends ("check out this object")

- Reads others' posts; no replies needed

### Secondary: Astronomy Peers (Operators/Astronomers)

- Log in with verified email

- Publish analysis notebooks (method + results + caveats)

- Link to FITS via NRAO

- Use as a lab notebook / preprint server

### Non-Target: Heavy Researchers

- They need serious WCS / reprojection / pipeline tools

- Not MVP scope; direct them to NRAO native tools (link-out)

---

## Success Metrics (MVP)

| Metric                  | Target             | How We Measure             |
| ----------------------- | ------------------ | -------------------------- |

| **First Paint**         | <1s on mobile 4G   | WebPageTest / RUM          |

| **Viewer Load**         | <2s                | RUM (real user monitoring) |

| **Post Creation**       | 3+ posts published | Database count             |

| **Verified Users**      | 10+                | Auth audit log             |

| **Uptime**              | 99.5%              | Status page                |

| **Permalink Stability** | 0 broken links     | Automated link checker     |

---

## Decision Locks (No Re-Litigating)

These are **final for MVP**. Do not reopen unless extraordinary circumstance.

✅ **Viewer:** Mode A (Aladin) only

✅ **FITS:** Constrained cutout passthrough + link-out; no full proxy/caching tier

✅ **Retention:** 90 days hot, no cold archive

✅ **Compute:** Rust for rendering; NestJS for indexing

✅ **Scope:** 3 pillars (SSR + viewer + community)

---

## Roadmap Outline (Reference Only)

### v1.0 (MVP)

Pillar 1 + 2 + 3 as defined above. ~4–6 weeks.

### v1.1 (Quick Wins)

- Comments on posts (1–2 weeks)

- User profiles + bio (1 week)

- Link preview for social sharing (1 week)

### v2.0 (Ambitious)

- Mode B (Canvas viewer as fallback)

- FITS download (in-app, if users demand + NRAO approves)

- WCS reprojection

- Team/org features

- Public API

---

## What This Document Does

✅ **Prevents scope creep:** If a feature isn't in the 3 pillars, it's deferred.

✅ **Guides tech decisions:** Stack is locked; no rewrites mid-project.

✅ **Aligns team:** Everyone knows what "done" means.

✅ **Unblocks shipping:** No "what if we add X" paralysis.

---

## Sign-Off

**Product Owner / Lead:** You
**Architecture / Tech Lead:** You
**Acceptance Criteria:** Pillar 1 + 2 + 3 complete, metrics met, no critical bugs.

---

**Last Updated:** 2026-02-07

## **Next Review:** After MVP launch (go/no-go for v1.1)

---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
