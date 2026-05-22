# Cowork

An overnight Claude Code agent workflow framework -- queue tasks before bed, wake up to commits and a morning report.

## How It Works

```
1. Define tasks     Add task blocks to TASKS.md with priority and type
2. Run session      cowork run -- validates, plans batches, executes, reports
3. Read results     Check MORNING_REPORT.md and git log
```

## Quick Start

```bash
npm install
npm run build

# Add a task
cowork add "Refactor auth module" --priority high --type refactor --context "Split into smaller functions"

# Validate your task file
cowork validate

# Preview execution order
cowork plan

# Run the full session
cowork run
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `cowork status` | Show task counts by status (pending, completed, failed, skipped) |
| `cowork plan` | Show execution plan with parallel/sequential batches |
| `cowork validate` | Check tasks for issues (circular deps, duplicates, missing fields) |
| `cowork run` | Full pipeline: validate, plan, execute, generate report |
| `cowork add "title"` | Generate a task block (`--priority`, `--type`, `--context`) |

All commands support `--json` for machine-readable output.

## Task Format

Tasks live in `TASKS.md`. Each task is an H2 block with a checkbox marker:

```markdown
## [ ] Task title
**Priority:** high | medium | low
**Type:** code | research | docs | refactor | test | design
**Context:** What needs to be done and why.
**Depends on:** Other task title
```

Status markers: `[ ]` pending, `[x]` completed, `[!]` failed, `[-]` skipped.

The file starts with a kill switch line -- set `# Status: OFF` to abort runs.

## Configuration

Optional `.coworkrc.json` in the project root:

```json
{
  "tasksFile": "TASKS.md",
  "reportFile": "MORNING_REPORT.md",
  "statusLine": "# Status: ON"
}
```

All fields are optional and fall back to the defaults shown above.

## System Files

| File | Purpose |
|------|---------|
| `TASKS.md` | Task queue with status markers |
| `MORNING_REPORT.md` | Auto-generated session report |
| `.coworkrc.json` | Optional configuration overrides |
| `dist/cli.js` | Compiled CLI entry point |

## Architecture

Source modules in `src/`:

| Module | Purpose |
|--------|---------|
| `types.ts` | Core type definitions (Task, ExecutionBatch, SessionResult) |
| `parser.ts` | Parses TASKS.md into Task objects |
| `scheduler.ts` | Builds execution batches from tasks, respecting dependencies |
| `validator.ts` | Validates tasks (circular deps, duplicates, missing fields) |
| `writer.ts` | Serializes tasks back to markdown, updates status markers |
| `reporter.ts` | Generates markdown report from session results |
| `runner.ts` | Session orchestration -- runs the execution plan |
| `killswitch.ts` | Reads Status: ON/OFF line to gate execution |
| `config.ts` | Loads and merges `.coworkrc.json` with defaults |
| `cli.ts` | CLI entry point with all commands |
| `index.ts` | Barrel re-exports |
