# SDLC Backlog

## [x] Scaffold the project structure
**Priority:** high
**Type:** code
**Context:** Create the initial folder layout, package.json, and base configuration files for the cowork project. This includes setting up a proper Node.js project with TypeScript, linting, and testing infrastructure.

---

## [x] Write unit tests for core utilities
**Priority:** medium
**Type:** test
**Context:** Add tests for any utility functions created during scaffolding. Target 80%+ coverage.
**Depends on:** Scaffold the project structure

---

## [x] Detect circular dependencies in the scheduler
**Priority:** high
**Type:** code
**Context:** Add `detectCircularDependencies()` function to scheduler, mark circular batches.

---

## [x] Add a task writer module for updating TASKS.md on disk
**Priority:** high
**Type:** code
**Context:** Create `src/writer.ts` with `updateTaskStatus` and `appendTask` functions.

---

## [x] Add a GitHub Actions CI workflow for tests and linting
**Priority:** medium
**Type:** code
**Context:** Create `.github/workflows/ci.yml` with typecheck, lint, test:coverage.

---

## [x] Validate task definitions during parsing
**Priority:** medium
**Type:** code
**Context:** Change `parseTasksFile` to return `ParseResult` with validation warnings.

---

## [x] Build the CLI entry point
**Priority:** high
**Type:** code
**Context:** Create `src/cli.ts` with `run`, `status`, and `report` subcommands.
**Depends on:** Add a task writer module for updating TASKS.md on disk

---

## [x] Add configuration file support
**Priority:** high
**Type:** code
**Context:** Create `src/config.ts` with CoworkConfig, loadConfig, resolveConfig.

---

## [x] Build the task executor module
**Priority:** high
**Type:** code
**Context:** TaskExecutor class with timeout, concurrency, and dependency skip.
**Depends on:** Add configuration file support

---

## [x] Add structured JSON output to the reporter
**Priority:** medium
**Type:** code
**Context:** generateJsonReport + --format flag for markdown/json report output.

---

## [x] Write integration tests for the task executor
**Priority:** medium
**Type:** test
**Context:** 6 integration tests covering full pipeline, writer, config, report.
**Depends on:** Build the task executor module

---

## [x] Add session history logging
**Priority:** low
**Type:** code
**Context:** src/history.ts with save/list/load + cowork history subcommand.
**Depends on:** Add structured JSON output to the reporter, Add configuration file support

---

## [x] Wire configuration file into the CLI
**Priority:** high
**Type:** code
**Context:** Integrate loadConfig/resolveConfig into CLI subcommand dispatch.

---

## [x] Add a CLI add subcommand
**Priority:** medium
**Type:** code
**Context:** cowork add --title/--priority/--type/--context/--depends-on.
**Depends on:** Wire configuration file into the CLI

---

## [x] Add progress callbacks and live status output
**Priority:** medium
**Type:** code
**Context:** ProgressEvent type, onProgress callback, createProgressFormatter.
**Depends on:** Wire configuration file into the CLI

---

## [x] Add per-subcommand --help with usage examples
**Priority:** medium
**Type:** code
**Context:** getSubcommandHelp for all 5 subcommands with descriptions and examples.
**Depends on:** Add a CLI add subcommand

---
