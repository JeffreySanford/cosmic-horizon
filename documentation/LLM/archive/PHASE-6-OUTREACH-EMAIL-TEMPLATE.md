# Phase 6 Outreach Email Template

Status date: 2026-02-22

Subject: Request for Sandbox Access or Sponsored Endpoint for Cosmic Horizons Remote Compute Gateway

Hello [Name/Team],

I am part of the Cosmic Horizons engineering team preparing a remote-compute
gateway integration for ngVLA-aligned workloads. We are requesting a minimal
access path to validate our live adapter against approved infrastructure.

What we need (minimum):

- A sandbox or low-risk endpoint for Tapis-style job submit/status/cancel flows.
- Enough allocation to run one trivial validation job (approximately 10 SU).
- Guidance on required auth fields and tenant/system identifiers.

What is already complete:

- Feature-gated live mode (`REMOTE_COMPUTE_MODE=live` / `TACC_LIVE=true`).
- Redaction/correlation-ID controls and rollback runbook.
- Offline test coverage and local simulation modes (`demo`, `local-llm`).

Validation plan (first pass):

1. Submit a trivial job.
2. Poll job status to terminal state.
3. Retrieve output metadata.
4. Verify audit trail (correlation IDs, redacted logs).

If direct access is not possible, a sponsored path or shared test tenant would
also work. We can adapt to your preferred interface and security process.

Timeline:

- Target outreach response: within 1 week.
- Integration rehearsal target: before the April 1, 2026 abstract milestone.

Thank you for your guidance. I can share a concise technical brief and runbook
on request.

Best,
[Your Name]  
[Role / Project]  
[Institution / Contact]  
