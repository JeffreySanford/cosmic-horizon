# Phase 6 Demo Script (Demo and Live Modes)

Status date: 2026-02-22

This script provides a reproducible operator flow for symposium rehearsal in
both `demo` and `live` modes.

## Preconditions

- API and web app are running.
- Environment variables are set per `documentation/reference/ENV-REFERENCE.md`.
- For live mode: valid TACC/CosmicAI credentials are available.

## Part A: Demo Mode Run

1. Set mode to demo:
   `REMOTE_COMPUTE_MODE=demo`
2. Restart API service.
3. Open jobs UI (`/jobs`) and submit a trivial dataset/job payload.
4. Confirm expected lifecycle transitions (`SUBMITTED -> QUEUED -> RUNNING -> COMPLETED`).
5. Open logs/audit view and confirm correlation ID appears.
6. Capture screenshot:
   - jobs list with terminal status
   - optimization tips panel
   - mode indicator badge

## Part B: Live Mode Run

1. Set mode to live:
   `REMOTE_COMPUTE_MODE=live` (or legacy `TACC_LIVE=true`)
2. Ensure required auth/env values are loaded (`TACC_TENANT_BASE_URL`,
   `TACC_CLIENT_ID`, `TACC_CLIENT_SECRET`, system/app identifiers).
3. Restart API service.
4. Submit one trivial job via UI or `POST /api/jobs/submit`.
5. Poll status until terminal state with `GET /api/jobs/{id}/status`.
6. Verify output metadata retrieval path.
7. Confirm redaction and correlation IDs in logs/events.
8. Capture screenshot:
   - submitted job ID/status
   - live mode indicator
   - audit/log excerpt with correlation ID

## Rollback Procedure (Live to Demo)

1. Clear live mode flag and set `REMOTE_COMPUTE_MODE=demo`.
2. Restart API service.
3. Re-run one demo submission to confirm recovery.

Reference: `documentation/runbooks/remote-compute-live-cutover.md`.

## Evidence Checklist

- Mode indicator visible for both runs.
- One successful demo submission trace.
- One successful live submission trace (or blocked-with-reason evidence).
- Correlation ID continuity evidence.
- Redaction evidence (no exposed secrets/tokens).
