# Status: ON

# Nightly Task Queue

> Add tasks below before sleeping. The orchestrator processes these top-to-bottom,
> running independent tasks in parallel. Mark completed tasks with [x].

---

## [x] Example: Scaffold the project structure
**Priority:** high
**Type:** code
**Context:** Create the initial folder layout, package.json, and base configuration files for the cowork project.

---

## [x] Example: Write unit tests for core utilities
**Priority:** medium
**Type:** test
**Context:** Add tests for any utility functions created during scaffolding. Target 80%+ coverage.
**Depends on:** Scaffold the project structure

---

## [x] Detect circular dependencies in the scheduler
**Priority:** high
**Type:** code
**Context:** `buildExecutionPlan` in `src/scheduler.ts` silently dumps tasks with circular dependencies into a final catch-all batch (lines 36-39) without signaling what went wrong. Add a `detectCircularDependencies(tasks: Task[]): string[][]` function that returns an array of dependency cycles (each cycle is an array of task titles). Integrate it into `buildExecutionPlan` so that when the `ready` array is empty but `remaining` still has tasks, the function annotates those tasks with a `skipped` status and includes a `cycleDependencies` diagnostic on the batch. Add tests for self-referencing tasks, two-node cycles, and longer chains. Export the new function from `src/index.ts`.

---

## [x] Add a task writer module for updating TASKS.md on disk
**Priority:** high
**Type:** code
**Context:** The system can parse TASKS.md via `parseTasksFile` but has no way to write changes back. Create `src/writer.ts` that exports: (1) `updateTaskStatus(filePath: string, taskTitle: string, newStatus: TaskStatus): Promise<void>` -- reads the file, finds the matching `## [<marker>] <title>` heading, replaces the marker (`[ ]` to `[x]`, `[!]`, etc.), and writes the file back; (2) `appendTask(filePath: string, task: Task): Promise<void>` -- appends a new task block at the end of the file using the template format from the TASKS.md comment. Both functions should use `node:fs/promises`. Add comprehensive tests using a temp directory (`node:fs/promises` + `node:os` `tmpdir`). Re-export both functions from `src/index.ts`.

---

## [x] Build the CLI entry point
**Priority:** high
**Type:** code
**Context:** There is no way to run this tool from the command line. Create `src/cli.ts` that uses Node.js built-in `parseArgs` (from `node:util`) with subcommands: `cowork run` -- reads TASKS.md (default `./TASKS.md`, override with `--file`), builds the execution plan, prints the batches to stdout as a summary, and exits (actual agent dispatching is a later task); `cowork status` -- reads TASKS.md and prints a table of tasks with their status, priority, and dependencies; `cowork report` -- reads a SessionResult JSON from stdin or `--input` file and writes the markdown report to stdout. Add a `"bin": { "cowork": "./dist/cli.js" }` entry to `package.json` and a hashbang to `cli.ts`. Add at least 5 tests using child_process `execFile` against the built CLI. This task depends on the writer module being available so `run` can mark tasks complete.
**Depends on:** Add a task writer module for updating TASKS.md on disk

---

## [x] Add a GitHub Actions CI workflow for tests and linting
**Priority:** medium
**Type:** code
**Context:** The repo has nightly/autolaunch workflows in `.github/workflows/` but no CI workflow that runs on pull requests. Create `.github/workflows/ci.yml` that triggers on `push` to `main` and on all `pull_request` events. It should: (1) check out the repo, (2) set up Node 20, (3) run `npm ci`, (4) run `npm run typecheck`, (5) run `npm run lint`, (6) run `npm run test:coverage`. Use a matrix strategy for Node versions 20 and 22 to catch compatibility issues early. The workflow should fail fast on any step failure.

---

## [x] Validate task definitions during parsing
**Priority:** medium
**Type:** code
**Context:** `parseTasksFile` in `src/parser.ts` silently defaults missing or invalid fields -- an empty priority becomes `'medium'`, an unrecognized type becomes `'code'`, and a missing context becomes an empty string. This hides user mistakes in TASKS.md. Add a `ValidationWarning` type (`{ taskTitle: string; field: string; message: string }`) and change `parseTasksFile` to return `{ tasks: Task[]; warnings: ValidationWarning[] }`. Collect warnings when: a priority/type value is unrecognized and gets defaulted, context is empty, a `dependsOn` reference does not match any other task title in the file, or a task title is duplicated. Existing callers that destructure only `tasks` must still work, so also export a convenience wrapper `parseTasksFileSimple(content: string): Task[]` that drops warnings. Update all existing tests to use the new return shape or the simple wrapper. Add new tests specifically for each warning case.

---
