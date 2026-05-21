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

## Session 2026-05-21

7. **Breaking return type changes need test updates**: When changing `parseTasksFile` from `Task[]` to `ParseResult`, all existing tests break. Worker agents that change return types must update ALL call sites — use `grep` to find every import before modifying.
8. **@types/node required for node: imports**: TypeScript projects using `node:fs/promises`, `node:util`, etc. need `@types/node` in devDependencies. Install it early when adding file I/O modules.
9. **Parallel workers sharing index.ts**: Multiple workers can safely add exports to `index.ts` simultaneously — the edits are append-only and don't conflict.
10. **Thin CLI wrapper + testable handlers pattern**: Splitting CLI into `cli.ts` (I/O, process.exit) and `cli-handlers.ts` (pure functions) keeps coverage high — the handlers get 95%+ coverage while the thin wrapper stays untested but trivial.
11. **sed for bulk test fixes**: When a return type changes across many test files, `sed -i 's/old/new/g'` is faster than individual Edit calls for mechanical replacements.

---
