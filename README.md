# Cowork — Claude Overnight Agent Workflow

While you sleep, a fleet of Claude Code agents works through your task queue, commits results, and leaves a morning report.

## How It Works

```
Before bed:  Add tasks to TASKS.md
             Run: claude -p ".claude/agents/orchestrator.md"

Overnight:   Orchestrator reads tasks
             Spawns parallel worker agents (one per independent task)
             Each worker: plans → implements → tests → commits

Morning:     Read MORNING_REPORT.md
             Review commits in git log
```

## Quick Start

```bash
# 1. Queue your tasks
nano TASKS.md

# 2. Launch the overnight run (detached)
nohup claude -p ".claude/agents/orchestrator.md" > logs/cowork.log 2>&1 &

# 3. Go to sleep. Check results in the morning.
cat MORNING_REPORT.md
git log --oneline
```

## Task Format (TASKS.md)

```markdown
## [ ] Task title
**Priority:** high | medium | low
**Type:** code | research | docs | refactor | test
**Context:** brief description of what needs doing and why
---
```

## System Files

| File | Purpose |
|------|---------|
| `TASKS.md` | Your nightly task queue |
| `MORNING_REPORT.md` | Auto-generated results summary |
| `logs/cowork.log` | Runtime logs |
| `.claude/agents/orchestrator.md` | Orchestrator agent prompt |
| `.claude/agents/worker.md` | Worker agent template |
| `.claude/agents/reporter.md` | Morning report generator |
| `scripts/cowork.sh` | One-command launcher |

## Maximizing Max Plan Usage

- Tasks run in **parallel** via sub-agents (independent tasks run simultaneously)
- Each agent uses the full context window for its task
- The orchestrator uses extended thinking to plan optimal execution order
- Continuous learning extracts patterns for future sessions

## Tips

- Queue 5-15 tasks for a full overnight run
- Mark dependencies clearly: `**Depends on:** Task X`
- High-priority tasks run first, then parallel batches fill remaining capacity
- Check `logs/cowork.log` if something looks incomplete
