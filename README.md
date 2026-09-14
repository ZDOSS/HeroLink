# HeroLink — RPG Maker MV/MZ Content Bridge

HeroLink lets an AI client read an RPG Maker project, stage edits, review the complete result, and apply or roll back a changeset. Desktop, MCP and CLI sessions share revisioned staging and a project lock.

## Start the desktop app

Use Node.js **22.12 or later** and an exported project containing `Game.rpgproject` or `Game.mzproject`.

```bash
npm ci
npm run electron
```

Select your project in Settings. Browse and edit entities, create an entity from an explicitly selected complete template, or use an AI client to draft changes. Pending Changes shows changed fields, complete before/after files and validation results. Applying always requires reviewing the current revision.

The desktop renderer calls a constrained preload IPC interface. The main process owns an authenticated loopback service; its launch token stays outside the renderer. The desktop service is not a browser API.

## MCP and standalone HTTP

```bash
# MCP over stdio
RPGMV_PROJECT_DIR=/path/to/project npm run dev

# Standalone HTTP, loopback only (default port 8866)
RPGMV_PROJECT_DIR=/path/to/project npm run http
```

Both expose the same 27 tools and schemas. Multiple sessions can share a project. Use a separate port when running standalone HTTP alongside the desktop service. Set `HEROLINK_TOKEN` on a standalone service to require a bearer token. Browser Origin headers and non-loopback Host headers are rejected.

```bash
# Discover tool names
curl http://127.0.0.1:8866/tools

# Read project identity
curl -X POST http://127.0.0.1:8866/api/tools/get_project_status \
  -H 'Content-Type: application/json' -d '{}'

# Inspect complete candidate files, validation and revision
curl -X POST http://127.0.0.1:8866/api/tools/diff_pending_changes \
  -H 'Content-Type: application/json' -d '{}'

# Replace REVIEWED_REVISION with the revision returned above
curl -X POST http://127.0.0.1:8866/api/tools/apply_patch \
  -H 'Content-Type: application/json' \
  -d '{"confirm":true,"expectedRevision":"REVIEWED_REVISION"}'
```

Creation requires **complete fields without an ID**. Read an existing entity with `get_entity`, explicitly choose it as a template, remove `id`, and edit the fields before calling `create_item_draft`, `create_skill_draft` or `create_entity_draft`. No game content or missing reference is guessed. Use the dedicated constrained command tools for event lists and pages. `add_plugin_draft.source` contains JavaScript source text, not a file path.

## CLI

```bash
npx tsx src/cli.ts status /path/to/project
npx tsx src/cli.ts list /path/to/project Item
npx tsx src/cli.ts validate /path/to/project
npx tsx src/cli.ts diff /path/to/project
npx tsx src/cli.ts apply /path/to/project --revision REVIEWED_REVISION
npx tsx src/cli.ts rollback /path/to/project

# Every production tool is available through the shared schema boundary
npx tsx src/cli.ts call /path/to/project validate_project_refs '{"includePending":true}'
```

CLI results, help and diagnostics go to stderr. Stdout is reserved for the MCP protocol. Errors carry a stable code and message; HTTP also uses appropriate 400/404/409 status codes for invalid input, missing entities and conflicts.

## Mutation and recovery guarantees

- Drafting persists only staging metadata. Only `src/mutate/apply.ts` writes project `data/` and `js/` files.
- Preview, pending validation and apply replay the same draft set through schema, reference and constrained-command validation. IDs are allocated sequentially from the complete candidate.
- Apply refuses changed project bytes or a different reviewed revision. All touched project files are backed up using their complete relative paths.
- A durable transaction manifest precedes atomic file replacement. It covers project files, journal and staging, including removal of newly created files after failure. A completed operation refreshes all in-memory model data and snapshots.
- Restart recovery verifies the entire manifest, captured baseline, journal/staging transition, backups and candidate before touching any target. Prepared operations are undone; committed operations are completed.
- Rollback verifies every post-apply hash and backup before writing. Later editor changes cause a conflict. Rollbacks unwind transactions in order and retain a backup of the state being rolled back.
- Project-root aliases are canonicalized. Internal symlink aliases, traversal paths and escapes are refused.

These transactions coordinate HeroLink processes. RPG Maker or another editor does not participate in the lock; finish external edits before reviewing/applying a changeset. Staleness checks detect observed changes, and a recovery conflict preserves the manifest for inspection.

See [recovery and compatibility notes](docs/audit-fixes.md) for legacy staging, old backups, runtime locks and verified engine behavior.

## Runtime inspection

In the desktop Documentation view, choose **Stage BridgeInspector Installation**, then review and apply it from Pending Changes. Start the MV game to use `inspect_runtime` and `preview_entity`. Installation uses the same backups, journal and rollback as any plugin draft.

The inspector restricts IPC to `.bridge/`, writes atomically, respects both shared-file locks, and records execution claims before previewing. Expired/cancelled commands are skipped and uncertain execution is reported without automatic replay. Game variables may contain text or other JSON values. No project note, damage formula or event script is evaluated by HeroLink.

MV/MZ database compatibility is checked against pinned real editor exports. MZ Effekseer animations and imported MV sprite animations are recognized. The inspector and interpreter behavior tests target MV; MZ runtime inspection and MZ-specific command authoring are not claimed as verified.

## Development and verification

```bash
npm ci
npm run check          # lint, typecheck, tests, enforced coverage
npm run build
npm audit
npm run test:e2e       # actual Electron window; Linux headless: xvfb-run -a npm run test:e2e
```

The test preflight fetches pinned MV/MZ exports into ignored `.cache/engine-fixtures/`. Subsequent runs use that cache. [Fixture provenance and verification scope](docs/audit-fixes.md#engine-reference-fixtures) describe the sources. Generated fixture data remains unchanged; disposable positive mutation tests supply the empty tileset missing from the deliberately minimal fixture.

Tests cover production HTTP/MCP tool contracts, repeated operations and session sharing, filesystem failures before/after rename, child-process interruption and restart, runtime plugin replay/lock behavior, desktop IPC lifecycle, renderer workflows and native Electron accessibility. Coverage includes the runtime plugin and desktop modules, with ≥90% lines/branches on mutation, validation, I/O and schemas and ≥75% overall. CI checks Linux, Windows and macOS; native desktop E2E runs on Linux.

## Packaging layout

Run `npm run build` before packaging. The Electron main process expects the compiled service at `resources/dist/http/server.js`, its production dependencies under the same resource root, and `resources/src/plugin/BridgeInspector.js` for draft installation. The bootstrap/preload use `.cjs`; application modules use ESM. An installer or distributable bundle is not provided by this repository.
