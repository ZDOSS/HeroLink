# Audit repairs and compatibility notes

This branch addresses the 17 findings from the 14 September 2026 audit of commit `30f9790`, plus its testing, dependency and usability items.

| Audit items | Repair and regression evidence |
| --- | --- |
| 1–2: escaping paths and prototype mutation | Canonical root checks, rejected internal symlink aliases, safe plugin basenames, strict entity fields, JSON Pointer escaping and prototype protection. Public and stored-state negative tests preserve legitimate slash/tilde plugin parameter names. |
| 3: invalid/incomplete writes | One candidate replay boundary for preview, pending validation, apply and apply recovery; complete creation fields; immutable IDs; constrained event authoring; schemas and equipment, trait, map, page and event-command references. |
| 4: lost shared drafts | Locked, revisioned staging reads before every operation; session model refresh independent of the persisted draft baseline; reviewed revision required for public apply. |
| 5–7: recovery, backup paths and destructive rollback | Durable transaction proof, exact byte backups, journal/staging recovery, new-file removal, post-hash rollback preflight and atomic model replacement. Failure injection covers errors before/after rename, metadata writes and actual process interruption. |
| 8: command semantics | Correct HP, variable/actor conditions, map-character animation input and nested branches, exercised with the official MV interpreter. |
| 9, 14–16: desktop connectivity, errors, lifecycle and installation | Preload/main IPC, authenticated readiness, private launch token, process-tree cleanup, explicit outage/retry and persistence errors, installation through drafts. |
| 10–12: page composition and plugin handling | Granular page edits; quote-aware plugin parsing; source-code input with exact previewed contents. |
| 13: runtime IPC | Atomic writes, command/response lock discipline, cancellation/expiry and durable execution receipts. Actual plugin source is tested with simulated game objects and injected filesystem failures. |
| 17: incomplete loading | Referenced maps and enabled plugin files fail with typed I/O errors; model reload builds a complete replacement before swapping session state. |
| Usability and maintenance | Editing, explicit complete templates, pagination, shared entity browser, field/whole-file review, keyboard navigation and modal focus, schema-validated settings, one tool registry/loader, production transport tests, enforced coverage, native accessibility checks, dependency refresh and CI. |

The required independent read-only patch review found four additional defects: stale models with new shared drafts, missing trait-reference checks, unproven recovery manifests, and rejected slash/tilde plugin parameter names. Each has a dedicated reproducer in `test/unit/review-regressions.test.ts`; recovery tampering is also tested in `mutation-boundaries.test.ts`.

## API compatibility

- Public `apply_patch` requires `confirm:true` and `expectedRevision` from `diff_pending_changes`. CLI apply requires `--revision`.
- Creation requires all standard fields except `id`; no defaults are invented for partial entities. Update IDs, raw command lists and raw pages are protected. Generic Troop creation uses `pages[].commands`, not engine opcode arrays.
- Map page updates use `mapId`, `eventId`, `pageIndex` and `page` together. Nested conditions/image edits compose. Animation commands use `characterId` (`-1` player, `0` current event, positive IDs for events on the current map).
- Diff output includes JSON, plugin configuration and plugin source plans, complete file bytes, validation and the review revision.
- Internal project symlinks are unsupported. External source files explicitly selected by the CLI for plugin import are read-only inputs, while every project destination is contained.
- CLI data and diagnostics use stderr. The desktop-owned HTTP service requires its private launch token; standalone HTTP/MCP sessions can share the same project through locked staging.

## Recovery operations

Do not remove `.bridge/transaction.json` to bypass an error. On restart, HeroLink validates it before recovering all files. If an editor changed a listed file to bytes matching neither recorded version, close all writers, preserve the entire `.bridge` directory and compare that file with the captured versions. Resolve the conflict explicitly before retrying.

Recovery requires complete journal/staging transitions and matching backups. Corrupt or fabricated manifests fail closed. Rollback refuses a missing/corrupt backup, a later external edit or a restored project that fails validation.

Old empty staging migrates without data loss. Old **pending** staging has no reliable baseline and is preserved but refused: stop all clients, preserve a copy of `.bridge`, move `staging.json` aside as `staging.legacy.json`, restart, and restage the exported intended changes against current project data. Legacy journal records without post-hashes cannot support verified automatic rollback; their original backups remain available for manual inspection.

Project coordination uses a short `project.gate` and an owned `project.lock`. Dead owned project locks can be reclaimed while holding the gate. An abandoned gate or ownerless/invalid lock is deliberately not removed automatically. After stopping every HeroLink process for that project and confirming no writer remains, preserve the lock directory for diagnosis, then remove only the abandoned coordination directories and restart. Never remove a live process's lock.

The runtime channel uses `commands.lock` and `responses.lock`. If the game or bridge is killed while holding one, stop both before removing abandoned channel lock directories. Queued commands retain expiry/cancellation information; restart cannot cause an expired preview to run. An interrupted execution claim is reported as uncertain instead of replayed.

## Engine reference fixtures

`npm run fixtures:engine` fetches immutable references into an ignored local cache; tests read JSON without executing game strings. The exports and their assets are not bundled or committed.

- MV: [Apress, Beginning RPG Maker MV](https://github.com/Apress/beg-rpg-maker-mv/tree/008e49db37e27b4da612c53fe2061bee09f2c28e), Chapter 1 export.
- MZ: [nz-prism RPG Maker MZ](https://github.com/nz-prism/RPG-Maker-MZ/tree/72424a466258667e6128eeff4d5c08c38a69e333/FieldAction), FieldAction export.
- Interpreter: [official MIT MV corescript](https://github.com/rpgtkoolmv/corescript/tree/182e31449707ba7e406db0485c44c2a9d11e2dcd), with its license retained in the cache.
- Schema reference: [official MZ database reference](https://rpgmakerofficial.com/product/mz/plugin/javascript/script_reference/database.pdf). Trait references follow [MV Game_BattlerBase](https://github.com/rpgtkoolmv/corescript/blob/182e31449707ba7e406db0485c44c2a9d11e2dcd/js/rpg_objects/Game_BattlerBase.js).

Real exports established boolean state-removal fields, optional historical state fields, decimal animation-cell coordinates and enemy condition values, standard weapon animation IDs, MZ message types and Effekseer animation data. Original generated fixtures remain untouched. Tests assemble a complete disposable positive fixture with its missing empty tileset; the original fixture still produces the expected missing-reference diagnostic.

## Verification scope

The native Linux Electron workflow covers connection, editing, template creation, complete review, apply, rollback, plugin/inspector drafting, outage/retry, minimum supported window size, keyboard modal focus and WCAG A/AA automated checks. Renderer and process unit tests cover additional errors and Windows process-tree invocation. CI runs core checks on Windows/macOS/Linux. Native Windows/macOS Electron windows, MZ runtime integration and installer packaging require their respective release environments; no packaged installer is claimed here.

Transactions protect against cooperating HeroLink processes and detect observed external edits. The RPG Maker editor does not acquire HeroLink's lock, so its concurrent writes cannot be made part of the same atomic transaction. Crash tests cover process interruption and atomic replacement failures; they do not simulate storage hardware failure.

## Local verification results

On Linux with Node 26.8.1:

- `npm run check`: passed, 387 tests; 92.71% overall line coverage and 85.08% branch coverage. Every configured critical-directory threshold passed.
- `npm run build`: passed.
- `xvfb-run -a npm run test:e2e`: passed the native Electron workflow, seven main-view accessibility checks, review-modal accessibility and keyboard focus checks. Screenshots were inspected at normal and minimum window sizes.
- `npm audit`: zero reported vulnerabilities, including development dependencies.
- `git diff --check`: passed.

Original audit triggers and the independent review's bypass cases are covered by regression tests; their invalid writes are refused. Successful create/update/apply/rollback sequences, multi-session drafting, real engine exports and desktop editing remain covered by positive controls.
