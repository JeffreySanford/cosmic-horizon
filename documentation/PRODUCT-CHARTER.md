# VLASS Sky Portal — MVP Product Charter

**Date:** 2026-02-07  
**Status:** ACTIVE  
**Owner:** You (portfolio + community)  
**Audience:** Internal (team alignment only)

---

## One-Line Product Definition

> **Fast VLASS sky browser + shareable permalinks + research notebook posts + snapshots.**

It's a **collaboration + publishing layer** on top of VLASS data, not an archive tool or FITS redistribution service.

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
- FITS in-app download — link-out only

---

### Pillar 2: Viewer + Permalinks + Snapshots

**Goal:** Users can explore the sky, share exact views with friends, and capture permanent snapshots.

**Scope:**

- Aladin viewer (Mode A only) with zoom/pan
- ViewerState as a first-class object: `/view?state=<encoded>` or `/view/<shortid>`
- Snapshot button: "Save PNG" → stores artifact (filesystem for MVP)
- Full viewer state serializable + deserializable

**Success Metric:** Permalink works 100% of time; snapshot artifact persists >7 days

**What's NOT Included:**

- Mode B fallback — Aladin is primary and only for MVP
- Server-side snapshot rendering — client-side PNG download only
- Dynamic rendering (GIF, video) — PNG snapshots only

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

| Feature               | Reason                                                  | When?                |
| --------------------- | ------------------------------------------------------- | -------------------- |
| **FITS Proxy**        | Link-out only; no NRAO approval complexity              | v2 (if users demand) |
| **Mode B Viewer**     | Canvas/Paper.js is v2; Aladin is plenty for MVP         | v2 (if Aladin fails) |
| **WCS Reprojection**  | Compute-heavy; clients can download + reproject locally | v2+                  |
| **FITS Generation**   | (same as proxy; out of scope)                           | v2+                  |
| **Comment System**    | Good first v1.1 feature, but not MVP                    | v1.1                 |
| **Team/Org Features** | Collaborative viewing can wait                          | v2+                  |
| **Mobile App**        | Web-only for MVP                                        | v2+                  |
| **User Profiles**     | Focus on posts, not bios                                | v2+                  |
| **Advanced Search**   | Tag-based discovery suffices                            | v2+                  |
| **API/SDK**           | Ship web app first; public API later                    | v2+                  |

---

## Technology Stack (Locked for MVP)

| Layer              | Tech                                               | Why                                       |
| ------------------ | -------------------------------------------------- | ----------------------------------------- |
| **Frontend**       | Angular 18 + Material 3 + SSR                      | Know it well; SSR is key to UX            |
| **Backend**        | NestJS + Postgres + Redis                          | Proven, maintainable, team familiar       |
| **Render Service** | Rust (sidecar) for PNG composition                 | Fast image rendering (preview + snapshot) |
| **Viewer A**       | Aladin Lite (CDN)                                  | Ready-made, proven, no custom build       |
| **Viewer B**       | (Deferred)                                         | Not in MVP                                |
| **Cache**          | Redis + local PVC                                  | Simple, no cost for preview artifacts     |
| **Persistence**    | Postgres (posts, revisions, tags) + S3 (artifacts) | Standard; play-it-safe for MVP            |
| **Async Jobs**     | Bull (Redis queue)                                 | Snapshot rendering jobs                   |
| **Deploy**         | Kubernetes + Helm                                  | Assume VLA has K8s; use it                |

---

## User Personas (MVP)

### Primary: Hobbyist + Community Member

- Browses VLASS casually (no login required for viewing)
- Verifies email to post
- Publishes one "cool thing I found" post per month
- Shares links with friends ("check out this object")
- Reads others' posts; no replies needed

### Secondary: Your VLA Friends (Operators/Astronomers)

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
✅ **FITS:** Link-out only (Option A)  
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
**Next Review:** After MVP launch (go/no-go for v1.1)
