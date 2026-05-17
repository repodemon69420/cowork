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

## Session 2026-05-17

7. **Separate I/O from logic for testability**: CLI entry points that do file reads/writes should be thin wrappers. Extract pure formatting functions (format.ts) so the logic is 100% testable without mocking fs/stdout.
8. **Add @types/node early**: Node built-in module imports (`node:fs`, `node:path`) need `@types/node` in devDependencies. Add it during scaffolding to avoid pre-existing type errors accumulating.
9. **Three-color DFS for cycle detection**: Iterative DFS with white/gray/black marking reliably detects all cycles in dependency graphs. Normalize cycle keys (rotate to lexicographic minimum) to avoid duplicate reports.
10. **Parallel batch execution**: When tasks have no dependencies between them, spawn worker agents simultaneously. Serializer + validator were independent and completed in parallel successfully.
11. **Lint early and fix immediately**: Running eslint after implementation catches unused imports and shadowed variables. Fix them in the same iteration rather than letting them accumulate across sessions.

---
