# Auth Verification UX (MVP)

Status date: 2026-02-07

Goal: Registration/login with clear failure states and immediate access to the MVP shell.

## Anonymous

- Can browse public pages

- Redirected to login for authenticated-only routes

## Authenticated

- Can access protected app routes

- Uses JWT token from `/api/auth/login` or `/api/auth/register`

- Login/register failures display API-derived error text when available

## Deferred Unlocks

- Email verification UX

- Comments/replies (v1.1)

## - FITS proxy privileges (v2 policy-gated)
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
