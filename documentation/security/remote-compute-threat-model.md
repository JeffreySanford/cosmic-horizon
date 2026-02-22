# Remote Compute Gateway Security Threat Model

_Status date: 2026-02-22_

This document outlines the security assumptions, threats, and mitigation
strategies for the Remote Compute Gateway feature set (demo, local-llm,
live modes), including dataset staging operations and local compute flows.
Its primary audience is security reviewers and developers preparing for a
live-cutover.

## Scope

- API endpoints exposed by `cosmic-horizons-api` related to job submission,
  status, cancellation, and data staging (including simulated errors/progress
  in demo/local modes).
- Local LLM compute server interfaces.
- Interaction patterns with external systems (Tapis, Slurm, Ollama).
- Authentication and authorization mechanisms.

## Threat categories

1. **Unauthorized access** – stolen credentials, misconfigured feature flags.
2. **Injection and malformed input** – JSON payloads, shell command
   parameters (Ollama), dataset identifiers.
3. **Resource exhaustion / rate abuse** – high-volume job submissions,
   local compute flooding.
4. **Data leakage** – output URLs, signed URLs, auth tokens in logs.
5. **Supply-chain risks** – untrusted NPM packages, Ollama model integrity.

## Mitigations

- Use `nestjs` guards and rate limiters; apply `llm-guards` for local compute.
- Schema validation with Zod on all inbound/outbound JSON.
- Store secrets in environment variables; never log raw tokens.
- Circuit breaker patterns for live adapter network calls.
- Periodic dependency scans and pinned versions.

## Next steps

- Review with internal security team prior to any public launch.
- Incorporate into CI compliance checks (e.g. dependabot alerts).
- Update this file when new interfaces are added or the threat landscape
  evolves.
