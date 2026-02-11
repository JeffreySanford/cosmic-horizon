# Database Schema (MVP)

Status date: 2026-02-07

This document is aligned to MVP entities and shared model contracts.

## Core MVP Tables

- users

- posts

- revisions

- snapshots

- audit_logs

- vlass_tile_cache (if enabled)

## Deferred Tables

- comments and comment-like entities are v1.1 scope.

When schema docs conflict with runtime DTOs, defer to `libs/shared/models` and active migrations.

## Seeding and bootstrap behavior is documented in `documentation/database/SEEDING-OPERATIONS.md`
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
