# Enabling Nx Cloud in CI (quick setup)

This file shows the minimal steps and example commands to enable Nx Cloud task distribution and flaky-task retries in CI using `pnpm dlx nx start-ci-run`.

1. Create/Connect your workspace to Nx Cloud

- Locally, run `pnpm dlx nx connect` and follow the prompts to connect the workspace to an Nx Cloud organization. This registers the workspace and produces an access token.

2. Add Nx Cloud token to CI secrets

- Add the token from step 1 as a repository secret, for example `NX_CLOUD_AUTH_TOKEN` in GitHub Actions (Repository Settings → Secrets).

3. Start the Nx Cloud CI runner early in your workflow

- Add this step as early as possible in your CI job (before `pnpm install`). Example GitHub Actions step:

```yaml
- name: Start Nx Cloud runner
  run: |
    pnpm dlx nx start-ci-run --distribute-on="1 linux-medium-js" --stop-agents-after="e2e-ci"
  env:
    NX_CLOUD_AUTH_TOKEN: ${{ secrets.NX_CLOUD_AUTH_TOKEN }}
```

- Explanation:
  - `--distribute-on` controls how many agents and which agent groups to allocate (example value shown; tune to your org infra).
  - `--stop-agents-after` will automatically stop agents after the specified target (e.g., `e2e-ci`) completes.

4. Use Nx Cloud to retry flaky tasks

- Once connected, Nx Cloud will detect flaky tasks and can retry them automatically. You do not need to change the individual `pnpm nx run` commands — the runner coordinates task distribution and retries for you.

5. Example recommended CI sequence

- Place the `Start Nx Cloud runner` step before dependency installation so agents are available early. A minimal sequence:

```yaml
- uses: actions/checkout@v4
- name: Start Nx Cloud runner
  run: pnpm dlx nx start-ci-run --distribute-on="1 linux-medium-js" --stop-agents-after="e2e-ci"
  env:
    NX_CLOUD_AUTH_TOKEN: ${{ secrets.NX_CLOUD_AUTH_TOKEN }}
- uses: pnpm/action-setup@v4
  with: { version: 9.8.0, run_install: false }
- uses: actions/setup-node@v4
  with: { node-version: 20, cache: pnpm }
- run: pnpm install --frozen-lockfile
```

Notes and tips:

- Tune `--distribute-on` to match your available CI agents or Nx Cloud agent types.
- If you cannot enable Nx Cloud immediately, the repository includes a simple retry wrapper `scripts/nx-retry.cjs` as a fallback (see `documentation/ci/nx-flaky-tasks.md`).
- Keep `NX_DAEMON` set to `false` in CI jobs (already used in workflows) to avoid interactive daemon behavior.
