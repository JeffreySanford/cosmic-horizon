# CI Artifact & Generated Files Checklist

This checklist explains how to handle generated artifacts (job-test outputs, reports, build artefacts) so they do not cause CI failures or get accidentally committed.

1. When adding a new generated artifact location (recommended name: `job-test/` or `tmp/`):
   - Add the path to `.prettierignore` and to any other formatting/linters ignore files. Example:
     - Add `job-test/` and `job-test/*.json` to `.prettierignore`.

2. Update `scripts/check-format-changed.mjs` (format checker):
   - Ensure the script filters out generated artifact paths before passing files to Prettier.
   - Example check: `if (file.startsWith('job-test/') || file.includes('/job-test/')) return false`.

3. Prevent accidental commits:
   - Add the path to `.gitignore` (if appropriate) and when already tracked, remove from index:

     ```bash

   git rm -r --cached job-test || true
   git commit -m "chore(ci): untrack generated job-test artifacts"

4. Update CI documentation and tests: when tests generate artifacts, prefer writing them to a configurable directory that is ignored by default and documented in this checklist.

5. Test isolation guidance:
   - For unit tests, prefer in-memory fakes or dependency injection so unit tests do not require external infra.
   - Reserve `docker-compose` infra for e2e or integration tests only.

6. CI workflows and nx-set-shas:
   - Ensure your GitHub Actions workflow explicitly sets `use-previous-merge-group-commit: false` for `nrwl/nx-set-shas@v4` on push-triggered runs that must use an exact HEAD.
   - Example in workflow:

     ```yaml
     - uses: nrwl/nx-set-shas@v4
       with:
         use-previous-merge-group-commit: false
     ```

7. When adding a new generated artifact, open a small PR that updates `.prettierignore`, `scripts/check-format-changed.mjs`, and `.gitignore` (if needed) together.

8. If CI fails on a generated file, download infra diagnostics (artifact `ci-infra-diagnostics`) and inspect `ci-docker-ps.log` and `ci-docker-logs.log` for container state and creation timestamps.

9. Keep this checklist up-to-date in `documentation/ci/ARTIFACTS_CHECKLIST.md` when CI or formatting tooling changes.

---
Last updated: 2026-02-24
