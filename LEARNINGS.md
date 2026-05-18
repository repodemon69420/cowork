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

## Session 2026-05-18

7. **Always install `@types/node`**: Node.js projects using `node:` protocol imports (`node:fs`, `node:path`, `node:url`) need `@types/node` in devDependencies even when `skipLibCheck: true` is set — `skipLibCheck` only skips `.d.ts` files, not module resolution.
8. **Run all quality scripts early**: Don't rely only on tests passing. Run `tsc --noEmit` and `eslint` in every iteration to catch type errors and lint issues before they accumulate.
9. **Unused imports in test files**: When test files import a symbol for use in one test group but not others, import it only where needed (e.g., via dynamic `import()`) or remove it from the static import to satisfy lint rules.

---
