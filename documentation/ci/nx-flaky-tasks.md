# Handling Flaky Nx Tasks

This document explains two approaches to mitigate flaky Nx tasks detected during CI runs:

1) Enable Nx Cloud flaky-task retries (recommended)

- Nx Cloud can automatically retry flaky tasks when it detects instability. See <https://nx.dev/ci/features/flaky-tasks> for details. To enable it in CI, configure Nx Cloud and set up the Nx Cloud runner in your CI environment. In many cases enabling Nx Cloud and connecting it to your CI will allow automatic retries without changing build scripts.

2) Use a lightweight retry wrapper (local/CI fallback)

- A small script `scripts/nx-retry.cjs` is included in this repo. It will rerun a given command up to `--retries` times. This is useful when you cannot enable Nx Cloud immediately.

Usage examples:

```bash
node scripts/nx-retry.cjs --retries=3 --delay=2000 -- pnpm nx run mvp-gates:e2e --output-style=stream
```

CI integration suggestion:

- Replace direct `pnpm nx run ...` invocations in CI with the retry wrapper. Example in GitHub Actions:

```yaml
- name: Run e2e (with retry)
  run: |
    node scripts/nx-retry.cjs --retries=3 --delay=2000 -- pnpm nx run mvp-gates:e2e --output-style=stream 2>&1 | tee e2e.log
```

Notes:

- The wrapper retries the entire command; it does not selectively retry only the failing tasks. When possible prefer Nx Cloud for more granular retries and caching benefits.
