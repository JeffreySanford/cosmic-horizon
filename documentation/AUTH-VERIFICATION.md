# User Verification & Authentication (MVP)

Status date: 2026-02-07
Canonical scope: `documentation/PRODUCT-CHARTER.md` + `SCOPE-LOCK.md`.

## Verification States
- Anonymous: read-only access
- Authenticated unverified: limited access
- Verified: can create/edit posts and revisions

## MVP Unlocks
- Post creation and revision workflows
- Verified user quotas

## Deferred Unlocks
- Comments/replies (v1.1)
- FITS proxy access paths (v2)

## Route Surface
- `POST /auth/register`
- `POST /auth/verify-email`
- `POST /auth/login`

All auth DTOs should align to contracts in `libs/shared/models`.
