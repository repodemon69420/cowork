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

## Session 2026-05-27

7. **Always install @types/node for Node.js projects**: If tests use `node:fs`, `node:path`, `node:url` or other Node built-ins, `@types/node` must be in devDependencies or `tsc --noEmit` will fail even though Vitest runs fine (Vitest resolves types differently).
8. **Run all three quality checks**: Tests passing alone is insufficient — always run `tsc --noEmit` AND `eslint src/` alongside `vitest run`. A previous session shipped with passing tests but broken typecheck and lint.
9. **Remove unused static imports when dynamic imports test re-exports**: Integration tests that verify barrel re-exports via `await import()` don't need the same symbols in static imports — ESLint will flag them.

---
