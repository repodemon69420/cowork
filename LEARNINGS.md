# Learnings

> Patterns and lessons extracted from each iteration. Applied to future sessions.

---

## Session 2026-05-16

1. **Regex field parsing**: When parsing markdown fields, support both formats (`**Field:** value` and `- **Field:** value`) since users may not be consistent. Make the leading dash optional.
2. **Parallel agent spawning**: Independent scaffolding tasks (configs vs source code) can be split across agents effectively for ~2x speedup.
3. **Coverage reporting**: `index.ts` barrel files and type-only files show 0% coverage which is expected — don't let it block the quality gate since they contain no testable logic.
4. **Detached HEAD in CI/remote envs**: Always check git branch state before committing. Remote execution environments may start in detached HEAD — checkout main first or merge after.
5. **Integration tests boost coverage of barrel files**: Importing from `index.ts` in integration tests naturally covers barrel re-exports that unit tests miss.
6. **Real file system tests**: Reading actual project files (TASKS.md) in integration tests catches format drift between parser assumptions and actual file format.

---

## Session 2026-05-23

1. **ESM modules can't be spied on**: `vi.spyOn` fails with "Cannot redefine property" on ESM exports. Use `vi.hoisted()` + `vi.mock()` at module level instead for mocking Node.js built-in modules.
2. **Running as root skips permission tests**: `chmod 0o000` has no effect when running as root. Use mock-based tests in a separate file for EACCES error branches instead of real filesystem permission tests.
3. **Separate mock test files**: When a test file uses `vi.mock()`, it affects the entire file. Create separate `*-errors.test.ts` files for mock-based error-path tests so integration tests can use real I/O.
4. **CLI testability via injection**: Making `run()` accept an optional `TaskRunner` parameter and a `print` callback makes the entire CLI pipeline testable without mocking — pass real files + mock runner for integration tests.
5. **Progress wrapper pattern**: Wrapping a TaskRunner with a logging layer (`wrapRunnerWithProgress`) adds observability without modifying the executor — keeps the executor pure and testable.
6. **Parallel worker conflicts**: Tasks that modify the same file (e.g. cli.ts) should NOT be parallelized. Implement them sequentially or in a single agent to avoid merge conflicts.
7. **Coverage on entry points**: CLI `main()` functions that call `process.exit()` are inherently untestable in vitest. Accept ~88% coverage on entry-point files — the testable `run()` function covers all logic.

---
