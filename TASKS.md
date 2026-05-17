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

## [x] Add a task serializer module
**Priority:** high
**Type:** code
**Context:** Create src/serializer.ts that converts Task[] back to TASKS.md markdown format. Must support: (1) serializeTasks(tasks) → full markdown string with headers and --- separators, (2) updateTaskStatus(content, title, newStatus) → updated markdown string with that task's checkbox changed. Write tests first (TDD). This enables programmatic updating of TASKS.md when workers complete tasks.

---

## [x] Add an input validation module
**Priority:** high
**Type:** code
**Context:** Create src/validator.ts that validates parsed Task[] arrays. Must detect: (1) circular dependencies — return the cycle, (2) duplicate task titles, (3) tasks with empty titles, (4) dependencies referencing non-existent tasks. Return a structured ValidationResult with errors and warnings arrays. Write tests first (TDD). This catches task graph problems before execution begins.

---

## [x] Add a CLI entry point
**Priority:** high
**Type:** code
**Context:** Create src/cli.ts that wires all modules together. It should: (1) read TASKS.md from the current directory, (2) parse tasks, (3) validate task graph and print any errors/warnings, (4) build the execution plan, (5) print a formatted summary showing batches and their tasks to stdout. Add a "bin" field to package.json pointing to dist/cli.js. Use process.argv for an optional --file flag to specify an alternate TASKS.md path. No external dependencies — use only node:fs and node:path. Write tests for the core logic (not the I/O).
**Depends on:** Add a task serializer module, Add an input validation module

---

## [x] Add an execution runner module
**Priority:** high
**Type:** code
**Context:** Create src/runner.ts that manages task execution state. It should: (1) take an ExecutionBatch[] from the scheduler, (2) track state transitions for each task (pending → running → completed | failed), (3) provide a function runBatch(batch, executor) where executor is a callback (task: Task) => Promise<{success: boolean, error?: string}>, (4) return a SessionResult when all batches are processed. The executor callback is what actually does the work — the runner just manages state and sequencing. Write tests using mock executors. Export: createRunner(batches: ExecutionBatch[]) → Runner and a Runner interface with methods like start(), getProgress(), getResult().

---

## [x] Add a structured logger module
**Priority:** medium
**Type:** code
**Context:** Create src/logger.ts with a JSON-lines structured logger for overnight sessions. It should: (1) write to a file path (configurable, default: logs/cowork.log), (2) support log levels (debug, info, warn, error), (3) each log entry is a JSON object with timestamp, level, message, and optional data field, (4) provide a createLogger(options) factory. Keep the implementation simple — use appendFileSync or a write stream. The logger is used by the runner and orchestrator to record what happened overnight. Write tests that log to a temp file and verify output format.

---

## [x] Add a configuration loader module
**Priority:** medium
**Type:** code
**Context:** Create src/config.ts that loads configuration from a .coworkrc.json file (if it exists) and falls back to sensible defaults. Config options: tasksFile (default: "TASKS.md"), logFile (default: "logs/cowork.log"), logLevel (default: "info"), coverageThreshold (default: 80), maxFileLines (default: 800), maxFunctionLines (default: 50). Export: loadConfig(cwd?: string) → Config and a Config interface. Use node:fs to check for file existence. Tests should verify defaults, file loading, and partial overrides.

---

<!-- INSTRUCTIONS:
  Copy the template below for each new task.
  Delete or comment out completed tasks.

## [ ] Task title
**Priority:** high | medium | low
**Type:** code | research | docs | refactor | test | design
**Context:** What needs to be done and why.
**Depends on:** (optional) other task titles this blocks on

-->
