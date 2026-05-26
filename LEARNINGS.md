# Learnings

> Patterns and lessons extracted from each iteration. Applied to future sessions.

---

## Session 2026-05-26

1. **@types/node required for node: imports**: TypeScript needs `@types/node` installed to resolve `node:fs/promises`, `node:path`, etc. Tests pass without it (Vitest handles it), but `tsc --noEmit` fails. Install it early.
2. **Parallel batch execution**: Three independent modules (io, writer, validator) were implemented simultaneously by separate agents — ~3x throughput vs serial.
3. **process.exit in testable code**: Functions that call `process.exit()` need special test handling — mock with `vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); } as never)` and catch in tests.
4. **Function length enforcement matters**: The `run` function naturally grew to 79 lines as features accumulated. Extract helpers proactively — validation, display, and core logic are natural split points.
5. **Round-trip testing**: Testing `parseTasksFile(serializeTasks(tasks))` catches subtle serialization bugs that unit tests miss. Always test codec pairs with round-trips.
6. **Type annotation on mock functions**: Avoid explicit return type annotations on `vi.spyOn` wrappers — TypeScript infers complex generic types that are hard to satisfy. Let inference handle it.
7. **TaskRunner abstraction**: Using a function type `(task: Task) => Promise<TaskStatus>` as a strategy pattern lets the executor be tested with simple stubs while supporting real agent execution later.
8. **tsconfig.build.json**: Always create a separate build config that excludes test files — the default tsconfig.json should include tests for IDE support but production builds should be clean.
9. **Build verification tests**: A test that runs `tsc --noEmit` via child_process catches import/export issues that IDE type-checking might miss, especially around ESM module resolution.
10. **Custom error hierarchy**: Extending Error with typed subclasses (FileNotFoundError, ConfigError) lets consumers do `instanceof` checks without string-matching. Always set `this.name` in the constructor for correct stack traces.
11. **Config precedence chain**: defaults < config file < CLI flags is the standard pattern. Implement by spread-merging: `{ ...defaults, ...configFile, ...cliOverrides }`, but only include CLI values that differ from defaults.
12. **Git operations in tests**: Always use `execFile` with `cwd` parameter for git helpers, and initialize temp repos with `git config user.name/email` for commits to work in CI environments without global git config.

---

## Session 2026-05-16

1. **Regex field parsing**: When parsing markdown fields, support both formats (`**Field:** value` and `- **Field:** value`) since users may not be consistent. Make the leading dash optional.
2. **Parallel agent spawning**: Independent scaffolding tasks (configs vs source code) can be split across agents effectively for ~2x speedup.
3. **Coverage reporting**: `index.ts` barrel files and type-only files show 0% coverage which is expected — don't let it block the quality gate since they contain no testable logic.
4. **Detached HEAD in CI/remote envs**: Always check git branch state before committing. Remote execution environments may start in detached HEAD — checkout main first or merge after.
5. **Integration tests boost coverage of barrel files**: Importing from `index.ts` in integration tests naturally covers barrel re-exports that unit tests miss.
6. **Real file system tests**: Reading actual project files (TASKS.md) in integration tests catches format drift between parser assumptions and actual file format.

---
