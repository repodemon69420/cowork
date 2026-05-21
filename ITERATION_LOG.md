# SDLC Iteration Log

> Tracks each iteration of the overnight SDLC session.

---

## Iteration 5 — CLI polish: config wiring, add, help, progress
**Status:** PASSED
**Tasks:** Config wiring, CLI add, per-subcommand help, progress callbacks
**Tests:** 216 pass, 0 fail (25 new tests added)
**Coverage:** 97%+ on logic modules
**Quality Gate:** PASSED (all criteria met)

**Batch 1 (sequential — 1 worker):**
- Wired loadConfig/resolveConfig into all CLI subcommands
- CLI flags now override config file values in proper priority order

**Batch 2 (parallel — 2 workers):**
- Added `cowork add` subcommand with --title/--priority/--type/--context/--depends-on (8 tests)
- Added ProgressEvent type and onProgress callback to TaskExecutor (8 tests)

**Batch 3 (sequential — 1 worker):**
- Added per-subcommand --help/-h with descriptions, flags, and examples (9 tests)
- Detects --help before parseArgs to avoid strict mode rejection

---

## Iteration 4 — Config, executor, JSON reporter, history
**Status:** PASSED
**Tasks:** Config support, task executor, JSON reporter, executor integration tests, session history
**Tests:** 185 pass, 0 fail (57 new tests added)
**Coverage:** 81.14% overall
**Quality Gate:** PASSED (all criteria met)

**Batch 1 (parallel — 2 workers):**
- Created src/config.ts: CoworkConfig, loadConfig, resolveConfig with validation (16 tests)
- Added generateJsonReport to reporter with structured JSON output (8 tests)
- Wired --format flag through CLI for markdown/json report selection (3 tests)

**Batch 2 (sequential — 1 worker):**
- Created src/executor.ts: TaskExecutor class with batch-sequential, task-parallel execution
- Per-task timeout via AbortController, concurrency limiting, dependency skip
- Added TaskRunResult type, wired --execute flag into CLI (15 tests)

**Batch 3 (parallel — 2 workers):**
- Added 6 executor integration tests (pipeline, writer, config, report, circular, JSON)
- Created src/history.ts: saveSessionLog, listSessionLogs, loadSessionLog (9 tests)
- Added cowork history subcommand with --log-dir option

---

## Iteration 3 — Core features, infrastructure, and CLI
**Status:** PASSED
**Tasks:** Circular dep detection, task writer, CI workflow, parser validation, CLI entry point
**Tests:** 128 pass, 0 fail (66 new tests added)
**Coverage:** 83.2% overall, 95%+ on all logic modules
**Quality Gate:** PASSED (all criteria met)

**Batch 1 (parallel — 4 workers):**
- Added `detectCircularDependencies()` to scheduler with DFS cycle detection (10 new tests)
- Created src/writer.ts: `updateTaskStatus` and `appendTask` for disk I/O (15 new tests)
- Created .github/workflows/ci.yml: Node 20+22 matrix, typecheck, lint, test:coverage
- Refactored parseTasksFile to return `ParseResult` with validation warnings (16 new tests)
- Added `parseTasksFileSimple` convenience wrapper for backward compatibility
- Added `@types/node` dev dependency, fixed lint unused import

**Batch 2 (sequential — 1 worker):**
- Created src/cli.ts: CLI entry point with run/status/report subcommands
- Created src/cli-handlers.ts: pure testable handler functions
- Added `bin` field to package.json for `cowork` command
- 26 new CLI handler tests covering all subcommands and edge cases

---

## Iteration 2 — Write unit tests for core utilities
**Status:** PASSED
**Task:** Write unit tests for core utilities
**Tests:** 62 pass, 0 fail (15 new integration tests added)
**Coverage:** 100% on all logic modules
**Quality Gate:** PASSED (all criteria met)

**Changes:**
- Created src/integration.test.ts with 15 end-to-end tests
- Full pipeline test: parse → schedule → report
- Real TASKS.md file parsing verification
- Edge cases: unicode, long strings, all-failed, all-completed, non-existent deps
- Re-export verification for index.ts barrel

---

## Iteration 1 — Scaffold the project structure
**Status:** PASSED
**Task:** Scaffold the project structure
**Tests:** 47 pass, 0 fail
**Coverage:** 99.37% statements, 100% on logic modules
**Quality Gate:** PASSED (all criteria met)
**Commit:** b176b58

**Changes:**
- Created package.json with TypeScript, Vitest, ESLint, Prettier
- Created tsconfig.json (strict, ES2022, NodeNext)
- Created eslint.config.js (flat config, @typescript-eslint)
- Created vitest.config.ts (v8 coverage, 80% thresholds)
- Created src/types.ts (Task, ExecutionBatch, SessionResult)
- Created src/parser.ts (parseTasksFile — markdown to Task[])
- Created src/scheduler.ts (buildExecutionPlan — dependency-aware batching)
- Created src/reporter.ts (generateReport — session results to markdown)
- Created src/index.ts (barrel re-exports)
- Created 3 test files with 47 comprehensive tests
- Fixed parser regex to handle both `**Field:** value` and `- **Field:** value` formats

---
