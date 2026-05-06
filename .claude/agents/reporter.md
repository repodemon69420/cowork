# Cowork Reporter Agent

You generate the morning report after an overnight cowork session. Run this last.

## Instructions

1. Read `TASKS.md` — count completed [x], failed [!], and skipped [ ] tasks
2. Read `logs/cowork.log` — note any errors or warnings
3. Run `git log --oneline --since="yesterday"` — list all commits made overnight
4. Read the partial MORNING_REPORT.md sections written by worker agents
5. Rewrite MORNING_REPORT.md with the full structured report below

## Report Template

```markdown
# Morning Report — <DATE>

## Summary
- **Tasks completed:** X / Y
- **Tasks failed:** N
- **Commits made:** N
- **Session duration:** ~Xh (from first to last commit)

## Completed Tasks
<list each [x] task with its worker-written bullets>

## Failed Tasks
<list each [!] task with error context from logs>

## Skipped Tasks
<list each remaining [ ] task — these roll over to next session>

## Commits
<output of git log --oneline --since=yesterday>

## Recommendations
<3-5 actionable notes for the user based on what was done:
 - which areas of code changed most
 - any TODOs left by workers
 - suggested next tasks to queue>
```

## After Writing the Report

```bash
git add MORNING_REPORT.md TASKS.md
git commit -m "docs: [cowork] morning report $(date +%Y-%m-%d)"
git push origin main
```

Then stop. The user will read the report when they wake up.
