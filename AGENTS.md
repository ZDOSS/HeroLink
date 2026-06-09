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

RPG MAKER MV SPECIFIC RULES:
21. ESM ONLY: This is an ESM project. Never use require(). Always use import statements. If you need
    dynamic imports, use await import().
22. VERIFY OPCODES: When implementing event commands, verify the opcode number against the RPG Maker MV
    source code or official documentation. Do not guess. Common opcodes:
    - Show Text: 101 (setup) + 401 (lines)
    - Control Switches: 121
    - Control Variables: 122
    - Conditional Branch: 111 (NOT 400)
    - Comment: 108 (first line) + 408 (continuation)
    - Terminator: 0
23. CURSOR ADVANCEMENT: When allocating IDs (entities, map events, etc.), you MUST advance the cursor
    after each allocation. Pattern: nextIds.set(type, id + 1) or mapEventIds.set(mapId, [...ids, newId]).
    Failure to advance causes duplicate IDs.
24. CONSISTENT PATH HANDLING: Use getRelPath(file, projectDir) consistently across all files. Never use
    split("/").slice(-2).join("/") or similar heuristics. This breaks for nested paths.
25. COMPLETE DIFF OUTPUT: When implementing diff/preview tools, include ALL write plan types (jsonPatch,
    pluginConfig, pluginFile). Do not silently omit any changes. Users need to see the complete picture
    before applying.

BUG FIX DISCIPLINE (prevent recurring mistakes):
26. GREP FOR THE SAME BUG: When fixing a bug found in one function, grep the entire project for
    the same pattern and fix ALL occurrences. Example: if writeJson return value is unchecked in
    processCommands, grep for all writeJson calls and check every one.
27. VERIFY FIXES DON'T INTRODUCE NEW BUGS: After applying a fix, trace the full code path of the
    changed function. Ask: "Could this fix create a race condition? Could it drop data? Could it
    return a misleading success?" Think about what OTHER process/thread might be doing concurrently.
28. CONVENTION SELF-CHECK: Before committing, re-read your own diff. For every write operation,
    verify it matches the convention used by every OTHER write in the same file. If the file uses
    writeFileAtomic.sync, don't use writeFileSync.

v5 CHANNEL PROTOCOL LESSONS (lessons learned from 7 rounds of review):
29. FILE-BASED IPC RULES: When implementing file-based inter-process communication:
    a. Every write function that returns success/failure MUST have its return
       value checked at every call site — grep for all callers, not just one.
    b. Cross-process read-modify-write MUST use a lock file (atomic mkdir)
       to prevent TOCTOU races between processes.
    c. Every timeout path MUST clean up its side effects (remove stale commands,
       release locks, etc.) before returning.
    d. Every deprecated/optional API (process.mainModule, etc.) MUST have a
       null guard before property access.
    e. Every hardcoded value (fixture names, IDs, etc.) in tests MUST be
       derived from the project model instead.
30. FIX COMPLETENESS CHECKLIST — before committing any fix, verify:
    a. Did I check every call site for the same pattern? (grep)
    b. Did my fix create a new race condition or failure mode? (lifecycle trace)
    c. Does every file write match the surrounding code's conventions? (diff check)
    d. Did I clean up all failure paths (timeouts, errors)? (edge case review)
    e. Is every lock/release pair wrapped in try/finally to prevent leaks?
    f. Is every user-facing input path (CLI, MCP, etc.) validated with the
       same Zod schema?  Never use TypeScript `as` casts as a substitute for
       runtime validation — they're a compile-time hint, not a runtime guard.
    g. Does the code match its comments? If a comment says "unlocked fallback"
       or "before releasing lock", the code must actually do that — fix the
       code or fix the comment, but never have both disagree.
    h. When adding a lock or other cross-process coordination to one shared
       file in a pair, apply the SAME pattern to the other file in the pair.
       Example: if you add `responses.lock`, also add `commands.lock` — the
       plugin and bridge both race on both files.
    i. When implementing a pattern (lock acquire/release, etc.), use the
       EXACT same return-type and guard convention everywhere. If
       `acquireResponseLock` returns `boolean` and guards `release` with
       `if (lockAcquired)`, then `ensureCommandLock` must do the same.
    j. In any polling loop, if ANY required lock cannot be acquired, release
       all held locks and return. Never proceed with a read-modify-write on
       a shared file without holding its lock.
    k. When a lock acquisition can fail (returns boolean), every call site
       MUST check the return value on the VERY NEXT LINE and bail/throw
       before the protected block. Never execute a write under a lock that
       was never acquired — proceeding unlocked defeats the entire purpose
       of the lock.
    l. Multi-step write sequences: when step N's write fails, all subsequent
       writes that depend on step N's success must be skipped or rolled back.
    m. After every getChannelPath() call, null-check the result before
       passing it to any fs.* API.
    n. Never use a busy-spin loop (retries without delay) as a lock
       acquisition strategy. It behaves identically to a single try and
       creates false confidence. Either use a real retry with exponential
       backoff or try once and fail immediately — there is no middle
       ground that buys you anything.
    o. When adding a negative test for a validation constraint, use an
       input that specifically discriminates the NEW constraint from the
       OLD one. If the test input would have been rejected by both,
       the test proves nothing.
    p. When adding validation to one command schema's field (e.g.
       name: z.string().min(1)), apply the SAME validation to all
       sibling schemas with the same field name. Inconsistency here
       is silent data corruption.
    q. When implementing RPG Maker event command opcodes, verify the
       parameter order against the actual RPG Maker MV/MZ source
       (Game_Interpreter). Parameter order is positional and wrong
       order produces silent game corruption with no error.
    r. Electron main processes must use .cjs extension when the project
        uses "type": "module" in package.json. .js files in ESM projects
        cannot use require() and will crash.
    s. Greptile reviews are embedded in the PR **body** (the description),
       between `<!-- greptile_comment -->` markers — NOT in the
       `gh pr view --json reviews` output. To check for new reviews,
       always fetch `gh pr view <N> --json body` and scan for
       `greptile_comment`. The `reviews` JSON field only shows placeholder
        data and is never the actual review content.
    t. To retrigger a Greptile review on a PR, mention @greptileai in a
       comment on the PR. Do NOT use \"gh pr comment --body /retrigger\"
       (on Windows the leading slash is treated as a file path). Use:
       gh pr comment <N> --body \"@greptileai\"
