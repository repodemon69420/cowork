#!/usr/bin/env bash
# queue-task.sh — Quickly add a task to TASKS.md from the command line
# Usage: ./scripts/queue-task.sh "Task title" "Context description" [priority] [type]
#
# Examples:
#   ./scripts/queue-task.sh "Add auth middleware" "JWT validation on all /api routes" high code
#   ./scripts/queue-task.sh "Write API docs" "Document all endpoints in OpenAPI format" medium docs

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TASKS_FILE="$REPO_ROOT/TASKS.md"

TITLE="${1:-}"
CONTEXT="${2:-}"
PRIORITY="${3:-medium}"
TYPE="${4:-code}"

if [ -z "$TITLE" ] || [ -z "$CONTEXT" ]; then
  echo "Usage: $0 \"Task title\" \"Context description\" [priority] [type]"
  echo ""
  echo "Priority: high | medium | low  (default: medium)"
  echo "Type:     code | research | docs | refactor | test  (default: code)"
  exit 1
fi

# Append task to TASKS.md before the instructions comment block
TASK_BLOCK="
## [ ] $TITLE
**Priority:** $PRIORITY
**Type:** $TYPE
**Context:** $CONTEXT

---"

# Insert before the <!-- INSTRUCTIONS comment
if grep -q '<!-- INSTRUCTIONS' "$TASKS_FILE"; then
  # Use temp file to insert before the comment
  TMP=$(mktemp)
  awk -v task="$TASK_BLOCK" '/<!-- INSTRUCTIONS/{print task; print; next}1' "$TASKS_FILE" > "$TMP"
  mv "$TMP" "$TASKS_FILE"
else
  echo "$TASK_BLOCK" >> "$TASKS_FILE"
fi

echo "Task queued: $TITLE"
echo "Priority: $PRIORITY | Type: $TYPE"

PENDING=$(grep -c '## \[ \]' "$TASKS_FILE" 2>/dev/null || echo 0)
echo "Total pending tasks: $PENDING"
