#!/usr/bin/env bash
# Monitor the latest GitHub Actions run for workflow name "CI" and exit when it completes.
cd "$(pwd)"
while true; do
  out=$(gh run list --workflow CI --limit 1 --json databaseId,conclusion,status 2>/dev/null || gh run list --limit 1 --json databaseId,conclusion,status 2>/dev/null)
  concl=$(echo "$out" | sed -n 's/.*"conclusion": *"\([^"]*\)".*/\1/p' | head -n1)
  status=$(echo "$out" | sed -n 's/.*"status": *"\([^"]*\)".*/\1/p' | head -n1)
  id=$(echo "$out" | sed -n 's/.*"databaseId": *\([0-9]*\).*/\1/p' | head -n1)
  if [ -n "$status" ] && [ "$status" = "completed" ]; then
    echo "CI_RUN_COMPLETED:$id:$concl"
    gh run view "$id" --log || true
    exit 0
  fi
  sleep 30
done
