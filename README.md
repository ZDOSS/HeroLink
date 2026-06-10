# HeroLink — RPG Maker MV/MZ Content Bridge

A local, file-based bridge that lets an AI client read, draft, validate, and safely write content into an RPG Maker MV or MZ project. Supports both engines (auto-detected via `Game.rpgproject` or `Game.mzproject`).

## Quick Start

### 1. Electron Desktop App (recommended)

```bash
npm install
npm run electron
```

Set your project folder in **Project Settings**, start the server, and use an AI client to draft content. Review and apply changes from the **Pending Changes** view.

### 2. CLI

```bash
# Project info
npx tsx src/cli.ts status path/to/project
npx tsx src/cli.ts list path/to/project Item

# Validate
npx tsx src/cli.ts validate path/to/project

# Draft + apply
npx tsx src/cli.ts pending path/to/project
npx tsx src/cli.ts diff path/to/project
npx tsx src/cli.ts apply path/to/project
npx tsx src/cli.ts rollback path/to/project
```

### 3. MCP Server (for AI clients)

```bash
RPGMV_PROJECT_DIR=path/to/project npx tsx src/index.ts
```

Exposes all 27+ tools for reading, drafting, validating, and applying changes.

### 4. HTTP API

```bash
# Start server
RPGMV_PROJECT_DIR=path/to/project npx tsx src/http/server.ts

# List tools
curl http://localhost:8866/tools

# Call a tool
curl -X POST http://localhost:8866/api/tools/get_project_status \
  -H 'Content-Type: application/json' -d '{}'

# Draft an item
curl -X POST http://localhost:8866/api/tools/create_item_draft \
  -H 'Content-Type: application/json' \
  -d '{"fields": {"name": "Hi-Potion", "itypeId": 1}}'

# Apply changes
curl -X POST http://localhost:8866/api/tools/apply_patch \
  -H 'Content-Type: application/json' -d '{"confirm": true}'
```

## Features

- **Read & Summarize** — browse project database, maps, events, plugins, notes
- **Audit & Validate** — reference-integrity checking with error/warn severity
- **Safe Mutation** — propose → validate → diff → apply → rollback pipeline; atomic writes, backups, staleness detection
- **Event Authoring** — constrained event-command builder for common events and map events
- **Plugin Management** — add plugins, set parameters
- **In-Engine Integration** — runtime inspection via `BridgeInspector.js` plugin (optional, see below)
- **Electron Desktop App** — 5-view control panel: Dashboard, Project Settings, Pending Changes, Documentation, Logs
- **Cross-Engine** — full support for both MV and MZ

## In-Engine Integration (BridgeInspector)

HeroLink includes an **optional** RPG Maker MV plugin called `BridgeInspector.js` (`js/plugins/BridgeInspector.js`). When installed in your project and loaded in-game, it enables two extra tools:

- **`inspect_runtime`** — reads live game state (current map, party, switches, variables) while the game is running
- **`preview_entity`** — triggers in-game previews of database entities

**To use it:**
1. Copy `js/plugins/BridgeInspector.js` from this repo into your project's `js/plugins/` folder
2. Add `BridgeInspector` to your project's plugin list in RPG Maker MV
3. Start the game — BridgeInspector will report status back to HeroLink

**This plugin is not required** for any other functionality. All read, draft, validate, and apply tools work without it. The plugin only affects the `inspect_runtime` and `preview_entity` tools.

## The Draft & Apply Workflow

Every change follows: **propose** (AI client creates a draft) → **review** (view pending changes with diffs) → **apply** (backup + validate + atomic write) → **rollback** (restore from backup if needed).

Key safety guarantees:
- No draft modifies files on disk until you explicitly apply
- Every apply creates a full backup and transaction journal
- Atomic writes (temp + rename) prevent corrupt files on crash
- Staleness detection refuses to apply if files changed on disk
- Rollback restores files byte-for-identical to pre-apply state

## Development

```bash
npm install
npm run check            # lint + typecheck + tests + coverage
npm run test             # tests only
npm run http             # start HTTP server only
npm run electron         # start Electron desktop app
```

## Project Structure

```
electron/                # Desktop app (main.cjs, preload, renderer SPA)
src/
  cli.ts                 # CLI entrypoint
  index.ts               # MCP server entrypoint
  http/server.ts         # HTTP API server
  io/                    # Project I/O + normalized model
  schema/                # Zod schemas for entities + event commands
  validate/              # Reference-integrity validation
  mutate/                # Staging, apply, rollback, backup, journal
  tools/                 # Tool handlers (one per file)
  engine/                # MV/MZ engine adapter
  plugin/                # BridgeInspector runtime plugin
test/                    # Vitest unit + integration tests
```

## Version Roadmap

| Version | Capability | Status |
|---------|-----------|--------|
| v1 | Read & Summarize | **Complete** |
| v2 | Audit & Validate | **Complete** |
| v3 | Safe Database Mutation | **Complete** |
| v4 | Events, Maps & Plugins | **Complete** |
| v5 | In-Engine Integration | **Complete** |
| v6 | Full Surface (HTTP API, MZ adapter, Advanced Events, Electron) | **Complete** |
| v7 | Review & Polish | **Complete** |
