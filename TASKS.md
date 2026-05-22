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

## [x] Add task validator module
**Priority:** high
**Type:** code
**Context:** Create src/validator.ts that validates an array of Task objects for integrity issues: circular dependencies, references to non-existent task titles in dependsOn, duplicate task titles, and missing required fields (title, priority, type). Return a structured ValidationResult with errors and warnings. Write tests first (TDD) in src/validator.test.ts.

---

## [x] Add task writer module
**Priority:** high
**Type:** code
**Context:** Create src/writer.ts that can serialize Task objects back to TASKS.md markdown format. It should support: generating a full TASKS.md string from a Task array, and updating a single task's status marker ([ ] to [x] or [!]) in an existing TASKS.md string by title. Write tests first (TDD) in src/writer.test.ts.

---

## [x] Add CLI entry point
**Priority:** medium
**Type:** code
**Context:** Create src/cli.ts as a CLI entry point using Node.js built-in parseArgs (no external deps). Support three commands: 'status' (parse TASKS.md and show task counts by status), 'plan' (parse TASKS.md, build execution plan, display batches), and 'validate' (run validator, print errors/warnings). Read TASKS.md from the current working directory. Add a "bin" field to package.json pointing to the compiled CLI. Write tests in src/cli.test.ts.
**Depends on:** Add task validator module, Add task writer module

---

## [x] Add GitHub Actions CI workflow
**Priority:** high
**Type:** code
**Context:** Create .github/workflows/ci.yml that runs on push and pull_request to main. Steps: checkout, setup Node 20, npm ci, npm run typecheck, npm run lint, npm run test:coverage. Use a simple single-job workflow. Fail the build if any step fails.

---

## [x] Add configuration module
**Priority:** medium
**Type:** code
**Context:** Create src/config.ts that defines a Config interface with tasksFile (default TASKS.md), reportFile (default MORNING_REPORT.md), and statusLine (default "# Status: ON"). Add a loadConfig() function that reads from a .coworkrc.json file in CWD if it exists, otherwise returns defaults. Merge file config with defaults (file values override). Write tests in src/config.test.ts. Export from index.ts.

---

## [x] Add error handling and exit codes to CLI
**Priority:** medium
**Type:** code
**Context:** Enhance src/cli.ts so the validate command exits with code 1 if there are validation errors (currently it just prints them). Add a --json flag to all commands that outputs JSON instead of formatted text. This enables scripting and piping. Update src/cli.test.ts with new test cases for --json output and exit code behavior. The run() function should return { output: string, exitCode: number } instead of just a string — update all callers.

---

## [x] Add kill switch module
**Priority:** high
**Type:** code
**Context:** Create src/killswitch.ts that exports a checkKillSwitch(content: string): { active: boolean; reason?: string } function. It checks the TASKS.md content for the status line. If the first line matching /^# Status:/ says "OFF", return { active: false, reason: "Status set to OFF" }. If it says "ON" or is missing, return { active: true }. Write tests in src/killswitch.test.ts. Export from index.ts.

---

## [x] Add session runner module
**Priority:** high
**Type:** code
**Context:** Create src/runner.ts that exports a runSession(tasks: Task[]): SessionResult function. It takes parsed tasks, builds the execution plan, simulates execution by marking all pending tasks as completed (actual subprocess execution is out of scope), and returns a SessionResult. Also export createSessionResult(completed: Task[], failed: Task[], skipped: Task[]): SessionResult that creates a SessionResult with startTime and endTime. Write tests in src/runner.test.ts. Export from index.ts.

---

## [x] Add full pipeline integration tests
**Priority:** medium
**Type:** test
**Context:** Add tests to src/integration.test.ts that exercise the full pipeline: parse TASKS.md content → validate → build plan → run session → generate report. Test that the report contains expected sections. Also test the kill switch + config + CLI modules together. Target: verify all modules work together coherently.

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
