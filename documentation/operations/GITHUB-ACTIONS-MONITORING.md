# Monitoring GitHub Actions with `gh` CLI

## Quick Start - Monitor Your Push

After pushing `d2bfc6b`, here's how to watch the CI tests in real-time:

### Option 1: Using GitHub Web Interface (Easiest)

1. Go to: <https://github.com/JeffreySanford/cosmic-horizon/actions>
2. Click on the latest workflow run (should be visible within seconds)
3. Watch for test status updates in real-time

### Option 2: Using `gh` CLI (Recommended)

#### Install `gh` First

```bash
# macOS
brew install gh

# Windows (PowerShell as Admin)
choco install gh
# OR
winget install GitHub.cli

# Linux
sudo apt-get install gh
# OR download from: https://github.com/cli/cli/releases
```

#### Authenticate with GitHub

```bash
gh auth login
# Follow prompts to authenticate with token or browser
```

#### Monitor Tests

```bash
# Show all recent runs
gh run list --repo JeffreySanford/cosmic-horizon

# Show only your latest push
gh run list --repo JeffreySanford/cosmic-horizon --limit 1

# Watch latest run (live updates)
gh run watch --repo JeffreySanford/cosmic-horizon

# ViewLogs for a specific run
gh run view <RUN_ID> --repo JeffreySanford/cosmic-horizon --log

# Retry a failed run
gh run rerun <RUN_ID> --repo JeffreySanford/cosmic-horizon
```

### Option 3: Using the Helper Script

```bash
# After installing gh, use our helper script:
bash scripts/monitor-actions.sh list     # Show recent runs
bash scripts/monitor-actions.sh latest   # Show latest run
bash scripts/monitor-actions.sh failures # Show failed runs only
bash scripts/monitor-actions.sh logs 1   # Show logs for run #1
bash scripts/monitor-actions.sh retry 1  # Retry run #1
```

## Understanding Workflow Status

### Status Colors

- 🟢 **Green (Success)** - All tests passed
- 🟡 **Yellow (In Progress)** - Tests are running
- 🔴 **Red (Failure)** - One or more tests failed
- ⚪ **Neutral (Cancelled)** - Workflow was cancelled

### Workflow Stages (in order)

1. **Setup** - Docker containers starting, dependencies installing
2. **Lint** - ESLint checking code style
3. **Build** - TypeScript compilation
4. **Unit Tests** - Jest tests running
5. **E2E Tests** - Playwright integration tests running
6. **Deploy** (if configured) - Deployment to staging/production

## Expected Results for Your Push

**Commit:** `d2bfc6b` - Environment configuration refactoring

**Expected to pass:**

- ✅ Lint (with warnings OK)
- ✅ Build (TypeScript compilation)
- ✅ Unit tests (2013+ tests)
- ✅ E2E tests (26 tests)
- ✅ Seeded user login tests

**What's being tested:**

- Environment configuration loads correctly
- Seeded users (<test@cosmic.local>, <admin@cosmic.local>) work
- All existing tests still pass
- New configuration files don't break compilation

## Troubleshooting Test Failures

### If tests fail on GitHub Actions

1. **Check the workflow logs:**

   ```bash
   gh run view <RUN_ID> --repo JeffreySanford/cosmic-horizon --log | tail -100
   ```

2. **Common issues:**
   - Environment variables not set in GitHub Secrets
   - Database connection fails (but we use Docker)
   - Node/pnpm cache issues (usually auto-cleared)
   - Port conflicts in Docker

3. **View specific job output:**

   ```bash
   gh run view <RUN_ID> --repo JeffreySanford/cosmic-horizon --verbose
   ```

4. **Retry the entire workflow:**

   ```bash
   gh run rerun <RUN_ID> --repo JeffreySanford/cosmic-horizon
   ```

## GitHub Actions URL Shortcuts

- **Actions Dashboard:** <https://github.com/JeffreySanford/cosmic-horizon/actions>
- **Latest Runs:** <https://github.com/JeffreySanford/cosmic-horizon/actions?query=branch%3Amain>
- **Failed Runs:** <https://github.com/JeffreySanford/cosmic-horizon/actions?query=conclusion%3Afailure>
- **Workflow Config:** <https://github.com/JeffreySanford/cosmic-horizon/blob/main/.github/workflows>

## Setting Up GitHub Secrets for CI

If tests fail due to missing environment variables:

1. Go to: **Settings → Secrets and variables → Actions**
2. Add these secrets:
   - `DB_PASSWORD` - PostgreSQL password (if not using default)
   - `JWT_SECRET` - Min 32 characters
   - `SESSION_SECRET`
   - `GITHUB_CLIENT_SECRET` (if testing OAuth)
   - `REDIS_PASSWORD` (if configured)

3. Reference in workflow:

   ```yaml
   env:
     DB_HOST: localhost
     JWT_SECRET: ${{ secrets.JWT_SECRET }}
   ```

## Real-Time Notifications

### Option 1: GitHub Web

- Star/Watch the repo for email notifications <https://github.com/JeffreySanford/cosmic-horizon>
- Check "Releases only" or "All activity" depending on preference

### Option 2: Terminal Notifications with `gh` (Recommended for failures-only)

```bash
# Failures-only: quick check
bash scripts/monitor-actions.sh failures

# Continuous failures-only poll (runs in terminal)
while true; do
  bash scripts/monitor-actions.sh failures
  sleep 10
done
```

> Note: The project monitoring preference is **immediate notifications only** — use `scripts/monitor-actions.sh failures` or `gh run watch` and inspect only failed runs. This avoids noisy updates and highlights regressions immediately.

### Option 3: Using the Helper Script

```bash
# After installing gh, use our helper script:
bash scripts/monitor-actions.sh list     - Show recent runs
bash scripts/monitor-actions.sh latest   - Show latest run
bash scripts/monitor-actions.sh failures - Show failed runs only
bash scripts/monitor-actions.sh logs 1   - Show logs for run #1
bash scripts/monitor-actions.sh retry 1  - Retry run #1
```

## Working with Failed E2E Tests

If E2E tests fail:

1. **Check if services started:**

   ```bash
   # View Docker logs
   docker ps  # See if postgres/redis running
   docker logs <container-id>
   ```

2. **Check if test user exists:**

   ```bash
   # Verify seeded users in database
   psql -U postgres -d cosmic_horizons -c "SELECT email, role FROM users;"
   ```

3. **Re-run E2E locally before investigating CI:**

   ```bash
   pnpm e2e:mvp
   ```

## Tips & Tricks

- **Live tail of logs:** `gh run view <ID> --repo JeffreySanford/cosmic-horizon --log --tail`
- **Get run ID from latest:** `gh run list --repo JeffreySanford/cosmic-horizon --limit 1 --json databaseId`
- **Format output as JSON:** `gh run list --repo JeffreySanford/cosmic-horizon --json status,name,createdAt`
- **Filter by branch:** `gh run list --repo JeffreySanford/cosmic-horizon --branch main`

## Next Steps

1. **After this push (`d2bfc6b`):**
   - Monitor your GitHub Actions at: <https://github.com/JeffreySanford/cosmic-horizon/actions>
   - Wait 2-5 minutes for initial setup
   - Tests should show green within 10-15 minutes total

2. **If all tests pass:**
   - Environment configuration is production-ready
   - Team can start using seeded users
   - CI/CD pipeline is validated

3. **If any test fails:**
   - Check logs with `gh` or web interface
   - See error messages
   - Fix locally and push again
   - Use `gh run rerun <ID>` to retry without re-pushing

---

**Commit pushed:** `d2bfc6b`  
**Branch:** `main`  
**Actions URL:** <https://github.com/JeffreySanford/cosmic-horizon/actions>
