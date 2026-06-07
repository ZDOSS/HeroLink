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
