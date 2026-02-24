#!/usr/bin/env bash
set -euo pipefail
runId=22335055482
echo "Watching CI run $runId..."
while true; do
  out=$(gh run view "$runId" --json status,conclusion 2>/dev/null || true)
  status=$(echo "$out" | sed -n 's/.*"status": *"\([^"]*\)".*/\1/p' | head -n1)
  concl=$(echo "$out" | sed -n 's/.*"conclusion": *"\([^"]*\)".*/\1/p' | head -n1)
  if [ -n "$status" ] && [ "$status" = "completed" ]; then
    echo "CI_RUN_COMPLETED:$runId:$concl"
    gh run view "$runId" --log || true
    exit 0
  fi
  sleep 15
done
