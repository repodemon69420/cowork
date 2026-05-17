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
