# ADR-001: Audit Retention — 90-Day Hot Only (MVP)

## Date

2026-02-11 (Updated: 2026-02-07)

## Status

ACCEPTED

## Context

VLASS Portal MVP needs audit logs for:

- Incident response & security investigation

- Moderation disputes

- Community guidelines enforcement

The scope question: how far back to keep queryable audit?

- 90 days is industry standard for SaaS operations

- MVP has no compliance obligations requiring longer retention yet

- Keeping it simple (no cold archive) unblocks faster shipping

Decision: Keep it simple for MVP. Archive strategy (cold tier) deferred to v2.

## Decision

Implement **90-day hot audit retention only** (MVP):

| Attribute     | Value                                           |
| ------------- | ----------------------------------------------- |

| Retention     | 90 days (configurable via `AUDIT_HOT_DAYS` env) |
| Storage       | Postgres primary table (`audit_events`)         |
| Indexing      | Timestamps, actors, actions, resources          |
| Query latency | <100ms                                          |
| Auto-deletion | Nightly job (00:02 UTC) purges records >90d     |
| Cost          | Minimal (no archive overhead)                   |

### Implementation

1. Audit events live in `audit_events` table

2. Nightly job:

   ```sql
   DELETE FROM audit_events
   WHERE created_at < NOW() - INTERVAL '90 days'

   ```

3. No compression, no PII redaction (all events are soft-deleted user data anyway per deletion policy)

4. Full data present: IPs, emails, request bodies, outcomes

## Rationale

**Why 90 days?**

- Covers typical incident forensics + moderation disputes

- Industry standard; matches Azure/AWS audit defaults

- Sufficient for MVP scope (community tool, not high-security infrastructure)

**Why no cold archive in MVP?**

- Reduces complexity (no S3, no redaction ETL, no batch queries)

- Team size doesn't require compliance officer yet

- If needed later: upgrade to two-tier (see deferred ADR-001-v2)

**Why hard delete (not soft)?**

- Simpler retention policy (audit events aren't user data)

- No GDPR exposure (public posts + action logs, not PII collection)

- Can be revisited if user-facing compliance audit is required

## Consequences (Chosen Option)

### Positive (Chosen Option)

- ✅ Simpler schema (no archive tables)

- ✅ Faster shipping (no ETL job)

- ✅ Sufficient for MVP moderation + ops (90d covers typical patterns)

### Negative (Chosen Option)

- ⚠️ No long-term forensics (can't investigate events >90d old)

- ⚠️ If required for compliance later, must backfill 2-year archive separately (manual process)

### Mitigation (Chosen Option)

- Schedule reviews at day 30: if compliance needs emerge, implement cold archive then

- Document decision: "MVP prioritizes simplicity; archive added in v2 if needed"

## Consequences

### Positive

- ✅ Hot retention queries remain <100ms (operations unimpacted)

- ✅ Compliance burden met (2-year archive available for discovery/forensics)

- ✅ Storage cost reduced by ~90% after day 90

- ✅ Auditable: compression logs and redaction rules recorded separately

### Negative

- ⚠️ Cold storage queries require batch fetch (not real-time)

- ⚠️ Redaction rules must be _perfect_ (PII leakage in cold tier is bad)

### Mitigation

- Automated test: verify redaction rules monthly

- Log: all compression/redaction to separate security audit trail

- Policy: never query cold tier from user-facing API; only ops/compliance requests

## Related Decisions

- Maps to DATA-RETENTION.md (normative spec)

- Complements RATE-LIMITING.md (which limits audit writes)

- Informs MONITORING-ALERTING.md (archive job monitoring)

---

**Owner:** Architecture

## **Review Date:** 2026-05-06 (Q2 planning)

---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
