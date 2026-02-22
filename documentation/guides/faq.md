# Remote Compute FAQ

This FAQ covers common questions for the remote-compute gateway while the team
operates in `demo`, `local-llm`, and `live` modes.

## What are the three access gates?

1. Identity/account access (institution-backed TACC/ACCESS account).
2. Allocation and membership (approved project with correct system access).
3. Interface enablement (Tapis API or SSH/Slurm path configured and validated).

## Which mode should I use locally?

- Use `REMOTE_COMPUTE_MODE=demo` for deterministic offline demos.
- Use `REMOTE_COMPUTE_MODE=local-llm` for local inference-backed behavior.
- Use `REMOTE_COMPUTE_MODE=live` only in approved environments with valid
  credentials.

## Is `TACC_LIVE` still supported?

Yes. `TACC_LIVE=true` remains a legacy compatibility switch, but
`REMOTE_COMPUTE_MODE` is the canonical selector.

## What constitutes a minimal demo for presentations?

A minimal demo scenario should be executable with no external credentials:

1. Start the gateway in `demo` or `local-llm` mode (default is demo).
2. Submit a trivial job and watch status progress through to COMPLETED.
3. Open the optimization‑tips panel and verify mock content appears.
4. Ping the `/api/health` and `/api/capabilities` endpoints and record the
   JSON responses.

Anything beyond this (e.g. live Tapis calls) requires the live flag.

## Where can I find security and testing documentation?

- Threat model for the gateway: `documentation/security/remote-compute-threat-model.md`.
- Test matrix and coverage plan: `documentation/testing/remote-compute-test-matrix.md`.

## What is the minimum live cutover proof?

- Submit one trivial job.
- Poll status to terminal state.
- Verify output metadata retrieval.
- Confirm correlation IDs and redaction in logs/events.

See `documentation/runbooks/remote-compute-live-cutover.md`.

## How do we roll back quickly if live mode fails?

Clear live mode (`REMOTE_COMPUTE_MODE=demo` or unset `TACC_LIVE`) and restart
the API to return to demo behavior.

## Where is the environment contract documented?

Use `documentation/reference/ENV-REFERENCE.md` as the canonical variable
reference.
