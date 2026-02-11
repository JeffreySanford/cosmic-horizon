# VLASS Sky Portal: Project Overview

Status date: 2026-02-07

## Mission
Ship a focused MVP collaboration layer on public VLASS data.

## Affiliation
This project is independently developed and publicly documented. It is not affiliated with, sponsored by, or operated for the VLA, NRAO, or the official VLASS program.

## Locked MVP Scope
1. SSR first paint with fast personalized preview (Pillar 1 complete)
2. Aladin viewer with shareable permalink state and snapshots
3. Community notebook posts with revisions

## Explicitly Deferred
- Mode B canvas viewer (v2)
- Go microservice (removed from MVP)
- FITS proxy/caching (link-out only)
- Comments/replies (v1.1)

## Runtime Architecture (MVP)
- `apps/vlass-web` (Angular SSR)
- `apps/vlass-api` (NestJS)
- `libs/shared/models` (shared contracts)

Rust remains optional for future advanced rendering. It is not required to ship MVP.

## Roles (MVP)
- Public: read-only viewing
- Verified users: create/edit/publish posts
- Moderators/Admins: hide/lock moderation actions

Comments are not in MVP; moderation currently applies to posts and tags.
