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

## [x] Add CLI entry point that wires core modules together
**Priority:** high
**Type:** code
**Context:** Create `src/cli.ts` that accepts a path to TASKS.md via process.argv, runs the parser and scheduler, and prints the execution plan to stdout. Include `--dry-run` to display batches without executing, `--output` to specify the morning report path, and `--help`. Register the bin entry in package.json so `npx cowork` works after install.

---

## [x] Add file-system adapter for reading TASKS.md and writing reports
**Priority:** high
**Type:** code
**Context:** Create `src/fs-adapter.ts` that exposes `readTasksFile(path: string): Promise<string>` and `writeReport(path: string, content: string): Promise<void>` with proper error handling (file not found, permission denied). This isolates all I/O behind a clean interface so the core modules stay pure and testable. Write corresponding tests.

---

## [x] Build the session executor that runs task batches
**Priority:** high
**Type:** code
**Context:** Create `src/executor.ts` that takes an `ExecutionBatch[]` from the scheduler and processes each batch. Capture results per task and map into `SessionResult` objects for the reporter. Implement configurable concurrency limit and timeout per task (default 30 minutes). This is the core runtime that makes cowork an actual orchestrator rather than just a planner.
**Depends on:** Add file-system adapter for reading TASKS.md and writing reports

---

## [x] Add GitHub Actions CI workflow for tests, typecheck, and linting
**Priority:** medium
**Type:** code
**Context:** Create `.github/workflows/ci.yml` that runs on push and pull request to main. Install dependencies, run typecheck, lint, and test with coverage. Fail the build if any step fails. Use Node 20.x and cache node_modules.

---

## [x] Wire end-to-end pipeline in CLI run mode
**Priority:** high
**Type:** code
**Context:** Wire the full pipeline in the CLI's non-dry-run path: read TASKS.md via fs-adapter, parse, schedule, execute via executePlan with a TaskRunner, generate report, and write it to output path. The TaskRunner should be a module that spawns subprocesses. Collect git commit hashes during execution for the report.

---

## [x] Add TASKS.md validation with actionable error messages
**Priority:** medium
**Type:** code
**Context:** Add a validateTasksFile function that returns structured diagnostics: missing required fields, unknown priorities/types, circular dependencies in dependsOn, and references to nonexistent task titles. Integrate into CLI — validation errors halt execution with exit code 1 in run mode, shown but non-blocking in dry-run mode.

---

## [x] Add integration test for the full CLI pipeline
**Priority:** high
**Type:** test
**Context:** Test the complete lifecycle: write a TASKS.md fixture to a temp dir, invoke CLI run with a mock TaskRunner, assert it reads, parses, schedules, executes, generates report, and writes it. Cover success, partial-failure, and error paths.
**Depends on:** Wire end-to-end pipeline in CLI run mode

---
