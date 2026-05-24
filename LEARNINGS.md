# Learnings

> Patterns and lessons extracted from each iteration. Applied to future sessions.

---

## Session 2026-05-24

1. **Parallel agent conflicts**: When spawning parallel agents that modify the same file (e.g., cli.ts and cli.test.ts), they can create conflicting changes. The last agent to write wins. Mitigate by having only one agent own each file, or fix up in the QA phase.
2. **vi.spyOn(process, 'exit') type mismatch**: In strict TypeScript with @types/node, the `process.exit` spy type doesn't match generic spy types. Use `any` type annotation with eslint-disable comment.
3. **ESM entry point guard**: Always wrap `main()` calls with `import.meta.url` guard to prevent side effects during test imports: `if (process.argv[1] === fileURLToPath(import.meta.url)) { main(); }`.
4. **Generic constraint for interfaces**: TypeScript interfaces don't satisfy `Record<string, unknown>`. Use `extends object` instead of `extends Record<string, unknown>` for generic constraints on interface types.
5. **Git adapter coverage**: Error catch blocks for git commands can't be triggered in a real git repo. Test with invalid refs to cover at least some error paths. Accept ~80% coverage for git adapter modules.
6. **State machine validation**: Encoding valid transitions as a lookup table (`Map<State, State[]>`) makes the transition validator both readable and testable — each edge is individually verifiable.
7. **Config fallback pattern**: CLI tools should try loading config but fall back to sensible defaults — never crash because config is missing.

---

## Session 2026-05-16

1. **Regex field parsing**: When parsing markdown fields, support both formats (`**Field:** value` and `- **Field:** value`) since users may not be consistent. Make the leading dash optional.
2. **Parallel agent spawning**: Independent scaffolding tasks (configs vs source code) can be split across agents effectively for ~2x speedup.
3. **Coverage reporting**: `index.ts` barrel files and type-only files show 0% coverage which is expected — don't let it block the quality gate since they contain no testable logic.
4. **Detached HEAD in CI/remote envs**: Always check git branch state before committing. Remote execution environments may start in detached HEAD — checkout main first or merge after.
5. **Integration tests boost coverage of barrel files**: Importing from `index.ts` in integration tests naturally covers barrel re-exports that unit tests miss.
6. **Real file system tests**: Reading actual project files (TASKS.md) in integration tests catches format drift between parser assumptions and actual file format.

---
