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

## [x] Fix TypeScript build errors — add @types/node
**Priority:** high
**Type:** code
**Context:** The integration tests use Node.js built-in modules (node:fs, node:path, node:url) but @types/node is missing from devDependencies. Run `npm install --save-dev @types/node` and verify `npx tsc --noEmit` passes cleanly.

---

## [x] Add file system adapter module
**Priority:** high
**Type:** code
**Context:** Create src/fs-adapter.ts with functions to read TASKS.md from disk (returning string content) and write report files (MORNING_REPORT.md, QA_REPORT.md). This keeps core modules pure — they take strings in and return strings out. The adapter handles all file I/O. Functions: readTasksFile(path) → string, writeReport(path, content) → void, fileExists(path) → boolean.

---

## [x] Add circular dependency detection to scheduler
**Priority:** medium
**Type:** code
**Context:** Currently if tasks have circular dependencies, the scheduler silently dumps them into a final batch. Instead, detect cycles explicitly using topological sort and return them as a `cycles` field on the result. Update the ExecutionPlan type to include `{ batches: ExecutionBatch[], cycles: string[][] }`. Throw or return error info so the orchestrator can report blocked tasks.

---

## [x] Add CLI entry point
**Priority:** high
**Type:** code
**Context:** Create src/cli.ts as an executable entry point. It should: (1) read TASKS.md from the current directory using the fs-adapter, (2) parse tasks with parseTasksFile, (3) build execution plan with buildExecutionPlan, (4) print the plan to stdout in a human-readable format. Add a "bin" field to package.json pointing to dist/cli.js. Support --file flag to specify a custom TASKS.md path. Keep it simple — no external dependencies.
**Depends on:** Add file system adapter module

---

## [x] Add GitHub Actions CI workflow
**Priority:** medium
**Type:** code
**Context:** Create .github/workflows/ci.yml that runs on push and PR to main. Steps: checkout, setup Node 20, npm ci, npm run typecheck, npm run lint, npm run test:coverage. Use a single job. Pin the actions to specific versions (actions/checkout@v4, actions/setup-node@v4).

---

## [x] Fix lint error — unused import in integration tests
**Priority:** high
**Type:** refactor
**Context:** src/integration.test.ts imports formatTaskSection but never uses it. Remove the unused import so `npx eslint src/` passes cleanly.

---

## [x] Add task serializer module
**Priority:** high
**Type:** code
**Context:** Create src/serializer.ts with a serializeTasksFile(tasks: Task[]) function that converts Task[] back to the TASKS.md markdown format — the inverse of parseTasksFile. This is needed by the orchestrator to update task statuses (mark [x], [!]) after workers complete. The output should round-trip cleanly: parseTasksFile(serializeTasksFile(tasks)) should return equivalent tasks.

---

## [x] Add config reader module
**Priority:** medium
**Type:** code
**Context:** Create src/config.ts to parse .claude/cowork-config.json into a typed CoworkConfig interface. Fields: repo (owner, name, url, localPath), orchestrator (triggerId, taskFile, outputFile), phone (toggleIssueNumber, toggleIssueTitle). Include a readConfig(configPath) function that reads and validates the JSON. Add a loadConfig() convenience that tries .claude/cowork-config.json from cwd.

---

## [x] Add task update command to CLI
**Priority:** medium
**Type:** code
**Context:** Add a --mark-done <title> flag to the CLI that reads TASKS.md, finds the task by title, changes its status from pending to completed, and writes the file back using the serializer and fs-adapter. This enables automated task status updates from the orchestrator. Error if task not found or already completed.
**Depends on:** Add task serializer module

---

## [x] Add task validator module
**Priority:** high
**Type:** code
**Context:** Create src/validator.ts with a validateTasks(tasks: Task[]) function that checks for: (1) duplicate task titles, (2) dependencies referencing non-existent tasks, (3) self-referencing dependencies. Return a ValidationResult with errors and warnings arrays. This is needed by the orchestrator to catch issues before spawning workers.

---

## [x] Add git adapter module
**Priority:** high
**Type:** code
**Context:** Create src/git-adapter.ts wrapping common git operations needed by the orchestrator: getCurrentBranch(), getLatestCommitHash(), getCommitsSince(ref: string), hasStagedChanges(), hasUncommittedChanges(). Use child_process.execSync to call git CLI commands. Each function returns typed results. Add proper error handling for when git is not available or not in a repo.

---

## [x] Add session state types and runner scaffold
**Priority:** medium
**Type:** code
**Context:** Create src/session.ts defining the orchestration state machine. Types: SessionState (idle, syncing, ideating, planning, building, testing, reviewing, merging, reporting), SessionContext (current iteration, branch, tasks, results), and SessionEvent (tick, taskComplete, testResult, reviewVerdict). Include a createSession(config: CoworkConfig) factory that returns an initial SessionContext. This is the foundation for the runner — just types and factory for now, no execution logic.
**Depends on:** Add config reader module

---

## [x] Add end-to-end CLI pipeline test
**Priority:** medium
**Type:** test
**Context:** Add a comprehensive integration test in src/integration.test.ts that tests the full write-parse-schedule-format pipeline: create a temp TASKS.md with various tasks (pending, completed, dependencies, cycles), run the CLI's formatPlan on it, verify output. Also test the mark-done round-trip: write file, mark a task done, re-read and verify status changed.

---

## [x] Add --validate flag to CLI
**Priority:** high
**Type:** code
**Context:** Add a --validate flag to src/cli.ts that reads TASKS.md, parses tasks, runs validateTasks from validator.ts, and prints the results. Show errors in red (prefix ERROR:), warnings in yellow (prefix WARNING:), and a final "Valid" or "Invalid" verdict. Exit 1 if there are errors, 0 otherwise. Import validateTasks. Add the flag to parseArgs and USAGE string. Add tests for the new flag.

---

## [x] Add logger module
**Priority:** medium
**Type:** code
**Context:** Create src/logger.ts with a simple Logger class. Methods: info(msg), warn(msg), error(msg). Each prepends a timestamp and level. The logger writes to an internal buffer (string[]) that can be retrieved with getLog(). Also provide a flush(filePath) method that writes the buffer to a file using writeFileContent. Keep it simple — no external dependencies. This will be used by the session runner for structured logging.

---

## [x] Add session step handlers
**Priority:** medium
**Type:** code
**Context:** Create src/steps.ts with pure functions for each session step. These take SessionContext and return a new SessionContext (immutability). Functions: stepSync(ctx) — transitions to syncing then planning, stepPlan(ctx, tasks) — builds execution plan and stores it, stepReport(ctx) — transitions to reporting. Each function validates state and throws if called in wrong state. This is the foundation for the session runner loop — just state transitions and data flow, no side effects.
**Depends on:** Add session state types and runner scaffold

---
