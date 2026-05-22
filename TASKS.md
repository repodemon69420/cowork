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

<!-- INSTRUCTIONS:
  Copy the template below for each new task.
  Delete or comment out completed tasks.

## [ ] Task title
**Priority:** high | medium | low
**Type:** code | research | docs | refactor | test | design
**Context:** What needs to be done and why.
**Depends on:** (optional) other task titles this blocks on

-->
