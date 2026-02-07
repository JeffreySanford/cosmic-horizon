# Project Status Scorecard

Last validated: 2026-02-07

## Source-of-Truth Model

- Product scope: `documentation/PRODUCT-CHARTER.md`, `SCOPE-LOCK.md`
- Contract scope: `libs/shared/models`
- Alignment policy: `documentation/SOURCE-OF-TRUTH.md`

## Required Gates

```bash
pnpm nx run docs-policy:check
pnpm nx run-many --target=test --all
pnpm nx run mvp-gates:e2e
```

## Scoring Model (Target >= 95)

| Dimension | Weight | Gate | Current |
| --- | ---: | --- | ---: |
| Documentation Alignment | 30 | `docs-policy:check` | 100 |
| Unit/Integration Baseline | 30 | `run-many --target=test --all` | 100 |
| MVP E2E Reliability | 30 | `mvp-gates:e2e` | 100 |
| Scope Discipline | 10 | Charter + scope-lock conformance | 95 |

Weighted success score: **99.5 / 100**

## Interpretation

- The engineering governance baseline is healthy.
- Remaining risk is product completion depth inside each MVP pillar, not quality
  gate health.
