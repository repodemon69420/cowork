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

## [x] Add task validator module
**Priority:** high
**Type:** code
**Context:** Create src/validator.ts that validates an array of Task objects for integrity issues: circular dependencies, references to non-existent task titles in dependsOn, duplicate task titles, and missing required fields. Return a structured ValidationResult with errors and warnings.

---

## [x] Add task writer module
**Priority:** high
**Type:** code
**Context:** Create src/writer.ts that can serialize Task objects back to TASKS.md markdown format. Support generating full TASKS.md from Task array and updating a single task's status marker in existing content.

---

## [x] Add CLI entry point
**Priority:** medium
**Type:** code
**Context:** Create src/cli.ts as a CLI entry point using Node.js built-in parseArgs. Support commands: status, plan, validate. Add bin field to package.json.
**Depends on:** Add task validator module, Add task writer module

---

## [x] Add GitHub Actions CI workflow
**Priority:** high
**Type:** code
**Context:** Create .github/workflows/ci.yml for automated testing on push/PR.

---

## [x] Add configuration module
**Priority:** medium
**Type:** code
**Context:** Create src/config.ts with Config interface and loadConfig() function that reads .coworkrc.json.

---

## [x] Add error handling and exit codes to CLI
**Priority:** medium
**Type:** code
**Context:** Enhance CLI with proper exit codes and --json flag for scriptable output.

---

## [x] Add kill switch module
**Priority:** high
**Type:** code
**Context:** Parse TASKS.md header for Status: ON/OFF.

---

## [x] Add session runner module
**Priority:** high
**Type:** code
**Context:** Create session orchestration logic: parse → plan → execute → result.

---

## [x] Add full pipeline integration tests
**Priority:** medium
**Type:** test
**Context:** End-to-end tests exercising all modules together.

---

## [x] Add CLI run command
**Priority:** high
**Type:** code
**Context:** Full pipeline execution via CLI.

---

## [x] Add CLI add command
**Priority:** medium
**Type:** code
**Context:** Generate new task blocks from command line.

---

## [x] Update README with complete documentation
**Priority:** low
**Type:** docs
**Context:** Updated README with all CLI commands and architecture.

---

## [x] Split oversized integration test file
**Priority:** high
**Type:** refactor
**Context:** Split integration.test.ts (702 lines) into two files under 400 lines each.

---

## [x] Improve runner module test coverage
**Priority:** medium
**Type:** test
**Context:** Boost runner.ts coverage from 83% to 96.61%.

---

## [x] Add build verification and npm bin setup
**Priority:** medium
**Type:** code
**Context:** Added prepublishOnly script, verified dist/cli.js build output.

---

## [x] Add CLI run command
**Priority:** high
**Type:** code
**Context:** Full pipeline execution via CLI.

---

## [x] Add CLI add command
**Priority:** medium
**Type:** code
**Context:** Generate new task blocks from command line.

---

## [x] Restore lost pipeline tests
**Priority:** high
**Type:** test
**Context:** Fixed 8 cross-module integration tests lost during file split.

---
