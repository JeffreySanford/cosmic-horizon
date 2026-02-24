# CI Playbook

Quick steps to force fresh workflow snapshots, re-run workflows, and split long jobs.

Force a fresh workflow run (useful when workflow snapshots or nx-set-shas behavior cause old SHAs):

1. Push a tiny non-empty commit to the target branch:

```bash
git add README.md
echo "ci: trigger $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> README.md
git commit -m "ci: trigger fresh workflow snapshot"
git push origin HEAD
```

2. Optionally re-run a specific workflow run in GitHub UI:
   - Open the repository Actions page → select the run → click "Re-run jobs" → choose "Re-run all jobs".

3. Use `gh` to re-run:

```bash
gh run rerun <run-id> --repo OWNER/REPO
```

4. Verify the `nrwl/nx-set-shas` settings are present in your workflow file:

Ensure the step includes:

```yaml
- uses: nrwl/nx-set-shas@v4
  with:
    use-previous-merge-group-commit: false
```

Splitting long CI jobs

- Separate `format`, `lint`, `unit-tests`, `build`, and `e2e` into distinct jobs so failures are visible and queued separately.
- Use `needs:` to express ordering; for example, `unit-tests` needs `format` so format failures fail fast.
- Cache dependencies per job to avoid re-install overhead; use the `actions/cache` or package-manager helpers.

Health checks

- Add a lightweight `health-check` job that runs after `format` and does a minimal infra readiness check (or a quick smoke test) before running full e2e.

When to use full infra

- Run docker-compose infra only for the `e2e` job. Keep unit tests isolated with fakes/mocks.

Troubleshooting

- If CI still reports an older NX_HEAD, the run may have been created from a previous merge-group snapshot. Re-run or push a fresh commit after confirming `use-previous-merge-group-commit: false` is in the committed workflow.

---
Last updated: 2026-02-24
