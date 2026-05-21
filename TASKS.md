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

## [x] Add configuration file support
**Priority:** high
**Type:** code
**Context:** The tool has no way to configure behavior without CLI flags. Create `src/config.ts` that exports: (1) a `CoworkConfig` interface with fields: `tasksFile` (string, default `'./TASKS.md'`), `outputFormat` (`'markdown' | 'json'`, default `'markdown'`), `logDir` (string, default `'./.cowork/logs'`), `concurrency` (number, default `4`), `timeout` (number in ms, default `300000`); (2) `loadConfig(cwd?: string): Promise<CoworkConfig>` that looks for `cowork.config.json` in the given directory (or `process.cwd()`), merges it with defaults using a shallow merge, and validates the values (e.g., concurrency must be a positive integer, timeout must be positive); (3) `resolveConfig(overrides: Partial<CoworkConfig>, fileConfig: Partial<CoworkConfig>): CoworkConfig` that merges CLI overrides > file config > defaults in that priority order. If the config file does not exist, silently fall back to defaults. If the file exists but contains invalid JSON, throw a descriptive error. Add the new types and functions to `src/index.ts` exports. Write at least 10 tests covering: defaults when no file exists, partial config merges, invalid JSON errors, invalid field values, CLI overrides taking precedence, and edge cases like empty objects.

---

## [x] Build the task executor module
**Priority:** high
**Type:** code
**Context:** The CLI can display an execution plan via `cowork run` but cannot actually execute tasks. Create `src/executor.ts` that exports: (1) `TaskExecutor` class that takes a `CoworkConfig` and an `ExecutionBatch[]` from the scheduler; (2) an `execute()` method that processes batches sequentially, running tasks within each batch in parallel (up to `config.concurrency`), calling a user-supplied `taskRunner: (task: Task) => Promise<TaskRunResult>` callback for each task; (3) a `TaskRunResult` interface `{ success: boolean; output: string; durationMs: number; error?: string }` added to `src/types.ts`; (4) the executor should enforce `config.timeout` per task using `AbortController` with `setTimeout`, marking timed-out tasks as `failed` with a timeout error message; (5) after each task completes, call `updateTaskStatus` from the writer module to persist the status to disk; (6) collect all results into a `SessionResult` and return it. The executor must handle errors gracefully -- if one task in a parallel batch fails, other tasks in the same batch should still complete, but tasks in later batches that depend on the failed task should be skipped. Wire the executor into `cli.ts` by adding an `--execute` flag to the `run` subcommand (when omitted, keep current dry-run behavior). Export all new types and the `TaskExecutor` class from `src/index.ts`.
**Depends on:** Add configuration file support

---

## [x] Add structured JSON output to the reporter
**Priority:** medium
**Type:** code
**Context:** The reporter in `src/reporter.ts` only generates markdown output, which makes it hard for other tools to consume session results programmatically. Add a `generateJsonReport(result: SessionResult, commits: string[]): string` function that returns a pretty-printed JSON string with the structure: `{ summary: { duration: string, totalTasks: number, completed: number, failed: number, skipped: number }, tasks: { completed: Task[], failed: Task[], skipped: Task[] }, commits: string[], generatedAt: string }`. Update `reportHandler` in `src/cli-handlers.ts` to accept a `--format` flag (`'markdown' | 'json'`, default `'markdown'`) and call the appropriate generator. Update the CLI argument parsing in `src/cli.ts` to pass `--format` through to the report handler. Add the new function to `src/index.ts` exports. Add at least 8 tests: JSON output structure validation, empty results, results with tasks in all categories, commit list inclusion, the `generatedAt` field being a valid ISO date, and the format flag routing in the report handler.

---

## [x] Write integration tests for the task executor
**Priority:** medium
**Type:** test
**Context:** The executor module needs thorough integration testing beyond its unit tests. Create `src/executor.test.ts` with at least 12 tests covering: (1) a simple single-batch execution with one task that succeeds; (2) parallel execution of multiple independent tasks in a batch; (3) sequential batch execution where batch 2 depends on batch 1; (4) a task that times out and is marked as failed; (5) a task that throws an error and is marked as failed while sibling tasks still complete; (6) downstream tasks being skipped when an upstream dependency fails; (7) the writer module being called after each task to persist status; (8) the returned `SessionResult` having correct `completed`, `failed`, and `skipped` arrays; (9) concurrency limiting (e.g., config.concurrency=1 forces serial execution even in parallel batches); (10) an empty batch list returning an empty session result; (11) the `--execute` flag on the CLI triggering actual execution vs dry-run; (12) timeout edge case where task finishes just before the deadline. Use a mock `taskRunner` callback that resolves/rejects based on test needs. Use `vi.useFakeTimers()` for timeout tests.
**Depends on:** Build the task executor module

---

## [x] Add session history logging
**Priority:** low
**Type:** code
**Context:** There is no record of past sessions once the process exits. Create `src/history.ts` that exports: (1) `saveSessionLog(logDir: string, result: SessionResult, commits: string[]): Promise<string>` that writes the JSON report (using `generateJsonReport` from the reporter) to `<logDir>/<ISO-timestamp>.json` and returns the file path, creating the `logDir` directory recursively if it does not exist; (2) `listSessionLogs(logDir: string): Promise<string[]>` that returns an array of log file paths sorted by timestamp descending; (3) `loadSessionLog(filePath: string): Promise<SessionResult>` that reads and parses a log file back into a `SessionResult`. Add a `cowork history` subcommand to `cli.ts` that lists past sessions with their date, duration, and task completion counts in a table (reuse the `padRight` helper from `cli-handlers.ts`). The default `logDir` should come from `CoworkConfig`. Export all new functions from `src/index.ts`. Write at least 8 tests using temp directories: saving and loading a log round-trips correctly, `listSessionLogs` returns files in reverse chronological order, missing `logDir` is created automatically, corrupt log files throw descriptive errors, empty log directory returns an empty list.
**Depends on:** Add structured JSON output to the reporter, Add configuration file support

---

## [x] Wire configuration file into the CLI
**Priority:** high
**Type:** code
**Context:** The config module (`src/config.ts`) exists with `loadConfig` and `resolveConfig` but the CLI (`src/cli.ts`) ignores it entirely -- every subcommand hardcodes its own defaults (e.g., `'./TASKS.md'` for `--file`, `DEFAULT_CONFIG.logDir` for `--log-dir`) instead of loading `cowork.config.json` and letting CLI flags override it. Refactor `main()` in `src/cli.ts` to: (1) call `loadConfig()` early, before subcommand dispatch, catching and printing config errors with `process.exit(1)`; (2) use `resolveConfig` to merge CLI flag overrides (`--file` maps to `tasksFile`, `--format` to `outputFormat`, `--log-dir` to `logDir`) on top of the file config; (3) pass the resolved `CoworkConfig` into each handler so subcommands use `config.tasksFile` instead of a raw `--file` string, `config.logDir` instead of `--log-dir`, and `config.outputFormat` instead of `--format`; (4) update `runHandler` to accept a `CoworkConfig` so that a future `--execute` implementation can use `config.concurrency` and `config.timeout`; (5) ensure that when no `cowork.config.json` exists, behavior is identical to today (defaults apply, CLI flags still override). Update the handler signatures in `src/cli-handlers.ts` where needed. Add at least 6 tests: config file values flow through to handlers, CLI flags override config file values, missing config file still works, invalid config file prints a user-friendly error and exits, `--file` override takes precedence over `tasksFile` in config, and the resolved config is passed to `runHandler`.
**Depends on:** Add configuration file support

---

## [ ] Add a CLI `add` subcommand for creating tasks from the terminal
**Priority:** medium
**Type:** code
**Context:** Users must hand-edit TASKS.md to add new tasks, which is error-prone and breaks the Markdown format if done carelessly. The `appendTask` function in `src/writer.ts` already handles the formatting and disk I/O. Add a `cowork add` subcommand to `src/cli.ts` that accepts: `--title <string>` (required), `--priority <high|medium|low>` (default `medium`), `--type <code|test|docs|...>` (default `code`), `--context <string>` (default empty string), and `--depends-on <comma-separated titles>` (optional). The handler should: (1) validate that `--title` is provided and non-empty, printing a clear error and exiting with code 1 if missing; (2) validate `--priority` and `--type` against the allowed values in `src/types.ts`, printing the valid options on error; (3) build a `Task` object with status `'pending'` and call `appendTask` using the resolved `config.tasksFile` path; (4) print a confirmation message like `Added task: "<title>" to <path>`. Create an `addHandler` function in `src/cli-handlers.ts` that takes the validated fields and the file path, calls `appendTask`, and returns the confirmation string. Export `addHandler` from `src/index.ts`. Write at least 8 tests: successful add with all fields, add with only required `--title` (defaults apply), missing `--title` error, invalid `--priority` error listing valid values, invalid `--type` error listing valid values, `--depends-on` with multiple comma-separated values, the appended task round-trips through `parseTasksFileSimple`, and the confirmation message includes the task title.
**Depends on:** Wire configuration file into the CLI

---

## [ ] Add per-subcommand --help with usage examples
**Priority:** medium
**Type:** code
**Context:** The CLI has a global `printUsage()` that lists subcommands, but running `cowork run --help` throws a `parseArgs` error instead of showing run-specific help. Each subcommand should respond to `--help` (and `-h`) with its own usage block that includes: a one-line description, all accepted flags with types and defaults, and 1-2 concrete usage examples. Refactor `src/cli.ts` so that each subcommand branch checks for `--help`/`-h` in `subcommandArgs` before calling `parseArgs` (since `parseArgs` with `strict: true` rejects `--help` as an unknown option). When detected, print the subcommand-specific help text and exit 0. The help text for each subcommand should be defined in a new `subcommandHelp` record in `src/cli.ts` keyed by subcommand name, making it easy to maintain as new subcommands are added. Cover all existing subcommands (`run`, `status`, `report`, `history`) plus the new `add` subcommand. Also update the global `printUsage()` to mention that `cowork <command> --help` shows command-specific help. Write at least 6 tests: `cowork run --help` exits 0 and includes `--file` and `--execute` in output, `cowork status -h` exits 0, `cowork report --help` documents `--input` and `--format`, `cowork add --help` documents `--title`, unknown subcommand still shows global help and exits 1, and `cowork --help` mentions per-subcommand help.
**Depends on:** Add a CLI `add` subcommand for creating tasks from the terminal

---

## [ ] Add progress callbacks and live status output during execution
**Priority:** medium
**Type:** code
**Context:** When `cowork run --execute` is invoked, the executor runs silently with no feedback until the entire session completes -- for long-running sessions with many tasks this leaves the user staring at a blank terminal. Add an event-based progress system: (1) define a `ProgressEvent` type in `src/types.ts` as a discriminated union: `{ type: 'batch-start'; batchIndex: number; taskCount: number }`, `{ type: 'task-start'; batchIndex: number; taskTitle: string }`, `{ type: 'task-end'; batchIndex: number; taskTitle: string; result: TaskRunResult }`, `{ type: 'batch-end'; batchIndex: number }`, `{ type: 'session-end'; result: SessionResult }`; (2) add an optional `onProgress?: (event: ProgressEvent) => void` callback parameter to the `TaskExecutor` constructor; (3) emit the appropriate events at each point in the `execute()` method; (4) in `src/cli.ts`, when `--execute` is used, wire up a default `onProgress` handler that prints human-readable lines to stderr (not stdout, so piped JSON output is unaffected): `[batch 1/3] Starting 4 tasks...`, `  [ok] Build the parser (1.2s)`, `  [FAIL] Run linter -- timeout after 300000ms`, `[batch 1/3] Done (3 ok, 1 failed)`, and a final summary line; (5) add a `--quiet` flag to `run` that suppresses progress output. Export `ProgressEvent` from `src/index.ts`. Write at least 8 tests: each event type is emitted at the right time, events fire in correct order for a multi-batch plan, the stderr formatter produces expected strings for success/failure/skip, `--quiet` suppresses output, and the `onProgress` callback being `undefined` causes no errors.
**Depends on:** Wire configuration file into the CLI

---
