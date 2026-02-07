# WebSocket Protocol (MVP)

Status date: 2026-02-07

## Topics
- `audit` (admin/ops observability)
- `jobs` (snapshot and async job progress)
- `ops` (moderation/system operational updates)

## Envelope
Each message includes:
- timestamp
- topic
- type
- correlation ID
- payload

## Deferred
- Comment-stream specific events (v1.1)
- Mode B pipeline events (v2)
- FITS proxy job events (v2)

Protocol contracts should align with shared transport/model contracts in `libs/shared/models`.
