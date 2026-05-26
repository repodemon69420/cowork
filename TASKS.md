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

## [x] Create file I/O module
**Priority:** high
**Type:** code
**Context:** Create src/io.ts that handles reading and writing files. Functions: readFile(path: string) → Promise<string> that reads a file and returns its content (throws if file not found), writeFile(path: string, content: string) → Promise<void> that writes content to a file (creates parent directories if needed), and fileExists(path: string) → Promise<boolean>. Use Node.js fs/promises. Write tests in src/io.test.ts using a temp directory. Keep the module pure — no side effects beyond file system access.

---

## [x] Create task serializer
**Priority:** high
**Type:** code
**Context:** Create src/writer.ts — the inverse of parser.ts. Functions: serializeTasks(tasks: Task[]) → string that converts Task[] back to the TASKS.md markdown format (preserving the header line "# Status: ON\n\n# Nightly Task Queue\n..."), updateTaskStatus(content: string, title: string, newStatus: TaskStatus) → string that takes existing TASKS.md content and updates a specific task's status marker ([x], [!], or [ ]), and appendTasks(content: string, newTasks: Task[]) → string that appends new tasks to existing content. Write tests in src/writer.test.ts. Round-trip property: parseTasksFile(serializeTasks(tasks)) should equal the original tasks (for well-formed input).

---

## [x] Create input validator
**Priority:** medium
**Type:** code
**Context:** Create src/validator.ts with functions: validateTasks(tasks: Task[]) → ValidationResult that checks for duplicate titles, missing required fields (title, priority, type), invalid enum values, and references to non-existent dependencies. Also detectCycles(tasks: Task[]) → string[][] that finds circular dependency chains using DFS. The ValidationResult type should have { valid: boolean, errors: ValidationError[] } where ValidationError = { task: string, field: string, message: string }. Write tests in src/validator.test.ts covering: valid input passes, each error type detected, cycle detection with simple and complex cycles.

---

## [x] Create CLI entry point
**Priority:** high
**Type:** code
**Context:** Create src/cli.ts as the main executable entry point. Parse command-line args using process.argv (no external deps): --tasks (path to TASKS.md, default ./TASKS.md), --output (path for report, default ./MORNING_REPORT.md), --dry-run (show execution plan without writing), --validate (validate tasks and report errors). Wire the pipeline: read tasks file → parse → validate → schedule → display plan. Add a "bin" entry in package.json pointing to dist/cli.js. Write tests in src/cli.test.ts that test the arg parser and pipeline logic (mock file I/O).
**Depends on:** Create file I/O module, Create task serializer, Create input validator

---

## [x] Add end-to-end CLI integration tests
**Priority:** medium
**Type:** test
**Context:** Create src/cli-integration.test.ts that tests the full CLI pipeline end-to-end. Use a temp directory with real TASKS.md files. Test cases: (1) parse and display a valid task file, (2) validate and report errors for invalid tasks, (3) dry-run shows execution plan, (4) full run writes a report file, (5) handles missing file gracefully, (6) handles empty task file. These tests exercise the real file I/O, parser, validator, scheduler, and reporter together. No mocks.
**Depends on:** Create CLI entry point

---

## [x] Create task executor module
**Priority:** high
**Type:** code
**Context:** Create src/executor.ts that actually executes the plan from buildExecutionPlan. Functions: (1) executeTask(task: Task, onComplete: (task: Task, status: TaskStatus) => void) → Promise<Task> that simulates executing a single task (updates its status to completed, calls the callback), (2) executeBatch(batch: ExecutionBatch, onComplete) → Promise<Task[]> that runs tasks in a batch — if batch.parallel is true, use Promise.all; if false, run sequentially, (3) executePlan(batches: ExecutionBatch[], onProgress?: (completed: number, total: number) => void) → Promise<SessionResult> that runs all batches in order, collects results into a SessionResult. The executor is the bridge between the scheduler's plan and the reporter's results. Write tests in src/executor.test.ts.

---

## [x] Add TypeScript build and verify CLI executable
**Priority:** high
**Type:** code
**Context:** Ensure `npm run build` produces working output in dist/. Add a "prepublishOnly" script that runs build. Verify the built CLI is executable by running `node dist/cli.js --help` after build. Add dist/ to .gitignore if not already there. Fix any build issues (e.g., test files should be excluded from build via tsconfig). Create a separate tsconfig.build.json that excludes test files from compilation. Write a simple build verification test in src/build.test.ts that checks the TypeScript compiler runs without errors (use child_process to run tsc).

---

## [x] Add ESLint integration and fix lint issues
**Priority:** medium
**Type:** refactor
**Context:** Run `npx eslint src/` and fix all reported issues. The ESLint config exists (eslint.config.js) but has never been run against the full codebase. Common issues will likely include: unused imports, prefer-const, any types, etc. After fixing all issues, add a "prelint" check that it actually works. Do NOT change the ESLint config unless absolutely necessary — fix the code to match the existing rules. Write the results of the lint run to show zero errors.

---

## [x] Wire executor into CLI for full pipeline
**Priority:** high
**Type:** code
**Context:** Update src/cli.ts to use the executor module when running in normal mode (not --dry-run, not --validate). The flow should be: read tasks → parse → validate → schedule → execute plan → update task statuses in TASKS.md → generate report → write report. Currently the CLI generates a static report without actually executing. After this change, running `cowork --tasks TASKS.md` should: (1) execute each batch, (2) update TASKS.md to mark completed tasks as [x], (3) write a report showing what was done. Update cli.test.ts and cli-integration.test.ts with tests for the new execution path.
**Depends on:** Create task executor module

---

## [x] Add progress output and summary statistics
**Priority:** low
**Type:** code
**Context:** Add real-time progress output to the CLI when running in normal mode. Show: "Executing batch 1/N (parallel)..." then "  [DONE] Task title" as each task completes. After all batches complete, show a summary: tasks completed, failed, skipped, total time. Use the onProgress callback from the executor. Add a --quiet flag that suppresses progress output. Write tests that capture stdout and verify the progress messages appear. This makes the CLI actually useful to watch while running.
**Depends on:** Wire executor into CLI for full pipeline

---

## [x] Create configuration module
**Priority:** high
**Type:** code
**Context:** Create src/config.ts that loads configuration from a `.coworkrc.json` file (if it exists) with fallback defaults. The Config interface should have: tasksPath (default: "./TASKS.md"), outputPath (default: "./MORNING_REPORT.md"), coverageThreshold (default: 80), maxFileLines (default: 800), maxFunctionLines (default: 50), parallel (default: true). Functions: (1) loadConfig(configPath?: string) → Promise<Config> that reads `.coworkrc.json` from the given path or the current directory, merges with defaults using spread operator, (2) mergeWithCliOptions(config: Config, cliOptions: CliOptions) → Config that lets CLI flags override config file values (CLI takes precedence). Write tests in src/config.test.ts using temp files. Test: loading default config, loading from file, missing file uses defaults, CLI overrides, partial config merges correctly.

---

## [x] Create structured logger module
**Priority:** medium
**Type:** code
**Context:** Create src/logger.ts with a simple structured logger. The Logger interface should have methods: info(message: string, data?: Record<string, unknown>), warn(message: string, data?: Record<string, unknown>), error(message: string, data?: Record<string, unknown>), debug(message: string, data?: Record<string, unknown>). Create a createLogger(options: { level: 'debug' | 'info' | 'warn' | 'error', quiet?: boolean }) function that returns a Logger. Output format: "[LEVEL] message" with optional JSON data on the same line. When quiet is true, only error level outputs. Write tests in src/logger.test.ts that capture stdout/stderr output and verify formatting and level filtering.

---

## [x] Create git utilities module
**Priority:** medium
**Type:** code
**Context:** Create src/git.ts with helper functions for git operations used by the orchestrator. Functions: (1) getCurrentBranch() → Promise<string> that runs `git rev-parse --abbrev-ref HEAD`, (2) createBranch(name: string) → Promise<void> that runs `git checkout -b <name>`, (3) commitAll(message: string) → Promise<string> that stages all changes and commits, returning the commit hash, (4) getRecentCommits(count: number) → Promise<string[]> that returns the last N commit messages. All functions should use child_process.execFile (not exec) to avoid shell injection. Wrap in try/catch with descriptive errors. Write tests in src/git.test.ts — use a temp directory with `git init` to create isolated test repos. Test each function including error cases (not a git repo, nothing to commit).

---

## [x] Add --config flag and config loading to CLI
**Priority:** high
**Type:** code
**Context:** Update src/cli.ts to support a --config <path> flag. On startup, load config using loadConfig from src/config.ts, then merge with CLI options using mergeWithCliOptions. This means the CLI respects: (1) defaults, (2) config file values, (3) CLI flags (highest priority). Update parseArgs to include configPath. Update the run function to load config before executing. Update tests to cover config integration. Keep the run function under 50 lines — extract a loadAndMergeConfig helper if needed.
**Depends on:** Create configuration module

---

## [x] Improve error handling with custom error types
**Priority:** low
**Type:** refactor
**Context:** Create src/errors.ts with custom error classes: CoworkError (base), FileNotFoundError (extends CoworkError), ValidationError (extends CoworkError), ExecutionError (extends CoworkError), ConfigError (extends CoworkError). Each error class should have a `code` property (string enum like 'FILE_NOT_FOUND', 'VALIDATION_FAILED', etc.) for programmatic error handling. Update io.ts to throw FileNotFoundError instead of generic Error. Update validator.ts to include a method that throws ValidationError when validation fails. Update cli.ts error handling to check error types and show appropriate messages. Write tests in src/errors.test.ts for error hierarchy and instanceof checks.

---
