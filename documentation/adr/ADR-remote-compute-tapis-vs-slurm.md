# ADR: Remote Compute Interface - Tapis First, Slurm Fallback

- Status: Accepted
- Date: 2026-02-22
- Owners: Remote Compute Gateway team

## Context

The platform must support remote job orchestration for ngVLA-scale workflows
while preserving a consistent API contract across `demo`, `local-llm`, and
`live` modes. We evaluated direct SSH/Slurm integration versus Tapis v3.

## Decision

Adopt **Tapis-first** for live integration, with **SSH/Slurm fallback** as a
contingency path when tenant/API constraints require it.

## Rationale

- Tapis aligns with current adapter and endpoint design (`submit`, `status`,
  `cancel`, files/systems capability checks).
- Tapis supports OAuth2 and tenant scoping, which fits gateway auth abstraction.
- The existing live adapter, fixtures, and tests are already Tapis-shaped.
- A Slurm fallback preserves optionality for sites that expose scheduler access
  without full Tapis parity.

## Consequences

- Live cutover runbooks and env contracts remain Tapis-centric.
- Security and observability controls must continue to validate OAuth2 token
  handling, redaction, and correlation IDs.
- Slurm fallback remains documented but is not the primary implementation track.

## Implementation Notes

- Canonical mode switch remains `REMOTE_COMPUTE_MODE` with `TACC_LIVE`
  compatibility.
- `LiveTaccAdapter` remains the default live adapter path.
- Any future Slurm adapter must preserve canonical job status mapping and audit
  event schema compatibility.
