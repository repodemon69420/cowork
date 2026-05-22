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

## Session 2026-05-22

1. **Testable CLI pattern**: Separate `run(args, content?)` from `main()` so the CLI logic is fully testable without file system or process mocking. The optional `content` parameter lets tests inject data directly.
2. **Parallel developer agents work well**: Spawning independent module agents (validator + writer) in parallel with no conflicts when they create separate files. Both edited index.ts but their changes were additive and non-conflicting.
3. **Fix pre-existing issues opportunistically**: The `@types/node` typecheck fix was pre-existing but blocked the quality gate. Installing it as part of the iteration kept the pipeline clean.
4. **DFS for cycle detection**: For circular dependency validation, DFS with an "in-stack" set is clean and handles arbitrary cycle lengths. Track `visited` globally and `inStack` per traversal path.
5. **Regex escaping for user-supplied patterns**: When matching task titles in markdown content, always escape special regex characters (`escapeRegExp`) to prevent injection of regex metacharacters from task titles.
6. **Three parallel agents with shared index.ts**: When multiple agents edit the barrel file (index.ts) concurrently, additive line appends rarely conflict. Both validator and writer agents added exports without issues.
7. **RunResult pattern for CLIs**: Returning `{ output, exitCode }` instead of just a string makes the CLI fully testable for both output content and exit behavior, without needing to mock `process.exit`.
8. **Config file with known-key filtering**: When loading user config from JSON, filter to only known keys before merging. This prevents typos from silently becoming config values and keeps the Config type honest.
9. **Kill switch as pure function**: Making `checkKillSwitch(content)` take a string rather than reading from disk keeps it testable and composable. The caller decides where the content comes from.
10. **Session runner simulation**: When actual execution is out of scope, marking pending tasks as completed provides a testable orchestration layer. Real execution can be plugged in later via a strategy function.
11. **Background agent race conditions**: Spawning agents in the background can cause file conflicts when they complete after other agents have already modified the same files. Prefer foreground for agents that touch shared files.
12. **Test file splits need careful verification**: When splitting test files, verify test counts before and after. Lost tests are silent failures — the suite still passes, just with fewer assertions.
13. **Mid-session pushes**: Pushing progress mid-session protects against container reclamation and lets users check work from their phone.

---
