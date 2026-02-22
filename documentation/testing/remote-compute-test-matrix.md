# Remote Compute Gateway Test Matrix

_Status date: 2026-02-22_

This matrix enumerates the combinations of gateway mode, API surface,
error conditions, and external dependency states that must be exercised
by automated tests and manual verification during development and the
live cutover.

| Mode       | Endpoint                         | Condition               | Test type     | Notes                       |
| ---------- | -------------------------------- | ----------------------- | ------------- | --------------------------- |
| demo       | /jobs/submit                     | success                 | unit/e2e      | uses simulator              |
| demo       | /jobs/submit                     | quota exceeded          | unit/e2e      | random failure generator    |
| demo       | /jobs/status                     | out-of-order update     | unit          | state machine tests         |
| local-llm  | /jobs/submit                     | rate limit exceeded     | contract      | applyRateLimit helper       |
| local-llm  | /jobs/result                     | invalid schema          | contract      | Zod validation              |
| local-llm  | /jobs/status                     | worker crash            | integration   | spawn/kill worker           |
| demo/local | /jobs/dataset/:id/validate       | dataset not found (404) | contract/unit | id contains `notfound`      |
| demo/local | /jobs/dataset/:id/validate       | access denied (403)     | contract/unit | id contains `forbidden`     |
| demo/local | /jobs/dataset/stage              | immediate failure       | contract/unit | id contains `error`         |
| demo/local | /jobs/dataset/:id/staging-status | completed with artifact | contract/unit | check artifact_url property |
| live       | /jobs/submit                     | 401 unauthorized        | mock-adapter  | start mock Tapis            |
| live       | /jobs/status                     | 503 service unavailable | mock-adapter  | circuit-breaker open        |

## Goals

- Ensure parity of canonical status values across all modes.
- Validate that guardrails (rate limits, schema) fire in both unit and e2e
  contexts.
- Create a separate CI shard for `local-llm` so that tests run with
  the local compute server booted.
- Maintain manual checklist for live-mode smoke tests as part of the runbook.

## Maintenance

Update this matrix whenever new endpoints are added or behavior diverges
between modes. Link to relevant Playwright specs, Jest suites, or external
load-test scripts as they are developed.
