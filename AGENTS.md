# Agent Operating Rules

HARD INVARIANTS (do not violate):
1. Only src/mutate/apply.ts writes to the project's data/ or js/. No other file performs writes.
2. No tool writes to disk without: passing whole-changeset validation, a clean staleness check,
   a backup of every touched file, and an atomic temp+rename write. Apply is all-or-nothing.
3. Resolve every path and assert it is inside the project root (post-realpath). Reject .. and symlink escapes.
4. Never write to stdout. All logs go to stderr. No console.log in src/.
5. Treat data shapes as reference baselines; the official docs and the fixture project are ground truth.
   If they disagree with the spec, fix the schema, not the data.
6. Never execute or eval a damage formula, note value, or any project string.
7. Do not author raw event-command arrays. Use the constrained command builder only.
8. If a referenced id/file/path is missing, fail with a typed error. Never substitute or guess.
9. Build in version order. A tool is not done until it has the tests required by §14.5.
10. When genuinely unsure, stop and ask — do not invent behavior or game content.

STATE MANAGEMENT (critical for MCP server correctness):
11. The MCP server holds a single Project instance across all tool calls in a session. After ANY
    operation that modifies files (apply, rollback), you MUST call reloadModel() to refresh both
    fileSnapshots and entity data. Stale in-memory state causes duplicate IDs and false staleness errors.
12. ALL disk writes must use atomic operations (writeFileAtomic.sync or equivalent). This includes
    journal writes, staging writes, and any other persistent state. Non-atomic writes can corrupt
    state on crash, breaking future operations.
13. Before implementing any feature, trace through the full lifecycle: What happens when this is called
    multiple times in the same session? What state persists between calls? What needs to be refreshed?
    Document these assumptions in code comments.

TESTING REQUIREMENTS (beyond §14.5):
14. Tests must verify multi-operation scenarios, not just single operations. For mutation tools, test:
    - Multiple applies in the same session (verify IDs are unique and sequential)
    - Apply → rollback → apply (verify no stale state errors)
    - Chained rollbacks (verify correct transaction unwinding)
15. Tests must assert correctness, not just success. Don't just check "no error thrown" — verify:
    - ID uniqueness across multiple creates
    - Sequential ID assignment
    - Correct state after rollback
    - File contents match expectations
16. When fixing a bug, add a test that reproduces the bug BEFORE fixing it. This ensures the bug
    doesn't regress and documents the failure mode for future developers.

CODE REVIEW CHECKLIST (before committing):
17. For every file write: Is it atomic? Does it handle crashes gracefully?
18. For every in-memory cache/snapshot: Is it refreshed after operations that change the underlying data?
19. For every tool: Does it work correctly when called multiple times in the same session?
20. For every test: Does it assert the right things, or just check that no error was thrown?
