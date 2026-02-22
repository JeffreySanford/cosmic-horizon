# Authentication Design Guide

This guide explains the authentication abstraction used by the Remote Compute
Gateway.

## Overview

The gateway must talk to TACC/CosmicAI backends, which require OAuth2 access
tokens.  To avoid sprinkling token logic throughout the code, we define an
`AuthProvider` interface:

```typescript
export interface AuthProvider {
  getAccessToken(): Promise<string>;
}
```

Adapters and services request tokens via this provider.  Two concrete
implementations exist:

* **DemoAuthProvider**: returns a static string (`'demo-token'`).  Used when
  `TACC_LIVE=false`.
* **LiveAuthProvider**: reads `TACC_ACCESS_TOKEN` and `TACC_ACCESS_TOKEN_EXPIRY`
  from configuration.  If the token is close to expiry it triggers a refresh
  (currently a stub that generates a new pseudorandom string).  In the future
  this class will implement the OAuth2 client credentials or refresh token flow.

Tokens are not stored in source control; configuration variables should be
managed via `.env` files, vaults, or CI secrets (see `.env.template`).

## Circuit breaker & retry

The adapter wraps network calls with a simple `CircuitBreaker` and
`fetchWithRetry` helper.  Failures increment the breaker; after a threshold is
reached the breaker opens and prevents further requests until a timeout elapses.
This improves resilience when live endpoints are flaky or credentials are
invalid.

## Status normalization

Backends may return different status strings (`RUNNING`, `FINISHED`, `SUCCESS`).
We normalize to a canonical enum:

```text
SUBMITTED | QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELED | UNKNOWN
```

The normalization function `normalizeStatus()` lives in the adapter library and
is exercised by unit tests.

## Extending the provider

To add real OAuth2 support:

1. Implement token request/refresh logic in `LiveAuthProvider.refreshToken()`.
2. Update configuration docs with required variables (client ID/secret,
   scopes, tenant URL).
3. Write tests that stub HTTP responses using `nock` or the CI mock server.

## Quickstart

```bash
# development/demo
TACC_LIVE=false pnpm start:api

# simulate live mode with dummy token (no external network)
TACC_LIVE=true TACC_ACCESS_TOKEN=dummy TACC_ACCESS_TOKEN_EXPIRY=$(( $(date +%s) + 300 )) pnpm test
```

Refer to `documentation/architecture/adr/002-auth-design.md` for the formal
architectural decision record.
