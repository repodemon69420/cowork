#!/usr/bin/env bash
# cowork.sh — Launch an overnight Claude Code cowork session
# Usage: ./scripts/cowork.sh [--foreground]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$REPO_ROOT/logs/cowork.log"
ORCHESTRATOR="$REPO_ROOT/.claude/agents/orchestrator.md"

# Ensure we're in the repo root
cd "$REPO_ROOT"

# Check dependencies
if ! command -v claude &>/dev/null; then
  echo "ERROR: claude CLI not found. Install Claude Code first." >&2
  exit 1
fi

if ! command -v git &>/dev/null; then
  echo "ERROR: git not found." >&2
  exit 1
fi

# Check for pending tasks
PENDING=$(grep -c '## \[ \]' TASKS.md 2>/dev/null || echo 0)
if [ "$PENDING" -eq 0 ]; then
  echo "No pending tasks found in TASKS.md. Add tasks before running."
  exit 0
fi

echo "Cowork session starting — $PENDING task(s) queued"
echo "Log: $LOG_FILE"
echo "Report will be written to: MORNING_REPORT.md"
echo ""

# Stamp the log
{
  echo "======================================"
  echo "Cowork session started: $(date)"
  echo "Tasks queued: $PENDING"
  echo "======================================"
} >> "$LOG_FILE"

# Initialize MORNING_REPORT.md for this run
cat > "$REPO_ROOT/MORNING_REPORT.md" << EOF
# Morning Report — $(date +%Y-%m-%d)

_Session in progress... check back after the run completes._

EOF

if [ "${1:-}" = "--foreground" ]; then
  # Run in foreground (for debugging)
  echo "Running in foreground..."
  claude --print -p "$ORCHESTRATOR" 2>&1 | tee -a "$LOG_FILE"
else
  # Run detached — safe to close the terminal
  nohup claude --print -p "$ORCHESTRATOR" >> "$LOG_FILE" 2>&1 &
  CLAUDE_PID=$!
  echo "Launched in background (PID: $CLAUDE_PID)"
  echo "Go to sleep. Check MORNING_REPORT.md when you wake up."
  echo ""
  echo "To monitor: tail -f $LOG_FILE"
  echo "To stop:    kill $CLAUDE_PID"
fi
