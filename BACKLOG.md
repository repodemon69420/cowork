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
**Context:** src/integration.test.ts imports formatTaskSection but never uses it.

---

## [x] Add task serializer module
**Priority:** high
**Type:** code
**Context:** Create src/serializer.ts — inverse of parseTasksFile. Converts Task[] back to TASKS.md markdown format.

---

## [x] Add config reader module
**Priority:** medium
**Type:** code
**Context:** Create src/config.ts to parse .claude/cowork-config.json into typed CoworkConfig interface.

---

## [x] Add task update command to CLI
**Priority:** medium
**Type:** code
**Context:** Add --mark-done flag to CLI for automated task status updates.
**Depends on:** Add task serializer module

---
