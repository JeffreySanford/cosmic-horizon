# ADR 002: Authentication & Authorization Abstraction

Date: 2026-02-21

## Context

The Remote Compute Gateway component needs to authenticate with backend
services (TACC/CosmicAI) using OAuth2 tokens when operating in live mode.
During development and demo phases, we rely on a simulated environment without
real credentials. Our previous implementation entangled token handling directly
inside the service, making it hard to test and swap contexts.

## Decision

Introduce an `AuthProvider` interface that exposes `getAccessToken(): Promise<string>`.
Two implementations are provided:

- `DemoAuthProvider` – returns a dummy token; used in demo/offline mode.
- `LiveAuthProvider` – stateful provider that reads tokens from configuration,
  handles expiry checks, and will implement OAuth2 refresh flows when real
  credentials become available. It also encapsulates token rotation logic.

The `LiveTaccAdapter` and other components take an `AuthProvider` instance, so
the token retrieval mechanism can be mocked or replaced without touching the
business logic.

A simple circuit breaker and retry/backoff wrapper around HTTP calls ensures
reliability in live mode. Status normalization maps diverse backend vocabularies
to a canonical enum used by the rest of the system.

## Consequences

- Testing becomes trivial: the adapter spec can inject a demo or live provider
  and simulate expiration and refresh.
- Live mode code remains clean; real OAuth2 logic can be implemented inside
  `LiveAuthProvider` when access is granted.
- The rest of the application (Orchestrator, frontend) interacts only with
  tokens and normalized statuses, insulating them from backend changes.

This ADR is versioned and referenced by
`documentation/LLM/REMOTE-COMPUTE-LLM/REMOTE-COMPUTE-GATEWAY-OFFLINE-WORK.md`.
