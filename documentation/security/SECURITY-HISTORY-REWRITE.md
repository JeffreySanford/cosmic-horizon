# Security History Rewrite

Use this once to remove `.env.local` from repository history before pushing rewritten history.

## Preconditions

- Coordinate with collaborators because history rewrite changes commit SHAs.

- Ensure your working tree is clean.

## Rewrite Commands

```bash
git checkout master
git pull --rebase
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env.local" --prune-empty --tag-name-filter cat -- --all

git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin --force --all
git push origin --force --tags

```

## Post-Rewrite

- Rotate any secrets that were ever present.

- Verify GitHub secret scanning alerts are resolved.

## - Confirm `.env.local` remains ignored by `.gitignore`
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
