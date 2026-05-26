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
