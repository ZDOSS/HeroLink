# RPG Maker MV/MZ Content Bridge

A local, file-based bridge that lets an AI client read, draft, validate, and safely write content into an RPG Maker MV or MZ project.

Supports both **RPG Maker MV** (auto-detected via `Game.rpgproject`) and **RPG Maker MZ** (auto-detected via `Game.mzproject`).

## Quick Start

### CLI

```bash
# Project status and entity counts
npx tsx src/cli.ts status path/to/your/project
npx tsx src/cli.ts data path/to/your/project

# List/search entities
npx tsx src/cli.ts list path/to/your/project Item
npx tsx src/cli.ts list path/to/your/project Item --query potion
npx tsx src/cli.ts get path/to/your/project Item 1

# Maps and events
npx tsx src/cli.ts maps path/to/your/project
npx tsx src/cli.ts events path/to/your/project 1
npx tsx src/cli.ts search path/to/your/project "hello"
npx tsx src/cli.ts notes path/to/your/project "type"

# Plugins
npx tsx src/cli.ts plugins path/to/your/project
npx tsx src/cli.ts set-plugin-param path/to/your/project MyPlugin Key Value
npx tsx src/cli.ts add-plugin path/to/your/project MyPlugin path/to/plugin.js

# Validation
npx tsx src/cli.ts validate path/to/your/project

# Draft and apply changes
npx tsx src/cli.ts pending path/to/your/project
npx tsx src/cli.ts diff path/to/your/project
npx tsx src/cli.ts discard path/to/your/project
npx tsx src/cli.ts apply path/to/your/project
npx tsx src/cli.ts rollback path/to/your/project
npx tsx src/cli.ts backups path/to/your/project

# In-engine integration (requires BridgeInspector plugin and running game)
npx tsx src/cli.ts inspect-runtime path/to/your/project --refresh
npx tsx src/cli.ts preview-entity path/to/your/project Item 1
```

### MCP Server (for AI clients)

```bash
# Set the project directory and start the MCP stdio server
RPGMV_PROJECT_DIR=path/to/your/project npx tsx src/index.ts
```

The MCP server exposes all 27 tools for reading, drafting, validating, and applying project changes.

### HTTP API

```bash
# Start the HTTP server (default port 8866)
RPGMV_PROJECT_DIR=path/to/your/project npx tsx src/http/server.ts

# Custom port and host
HTTP_PORT=3000 HTTP_HOST=0.0.0.0 RPGMV_PROJECT_DIR=path/to/your/project npx tsx src/http/server.ts

# List available tools
curl http://localhost:8866/tools

# Call a tool
curl -X POST http://localhost:8866/tools/get_project_status \
  -H 'Content-Type: application/json' -d '{}'

# Draft and apply
curl -X POST http://localhost:8866/tools/create_item_draft \
  -H 'Content-Type: application/json' -d '{"fields": {"name": "Hi-Potion", "itypeId": 1}}'
curl -X POST http://localhost:8866/tools/apply_patch \
  -H 'Content-Type: application/json' -d '{"confirm": true}'
```

## Development

```bash
npm install
npm run check                    # lint + typecheck + tests + coverage
npm run test                     # tests only
npm run test:watch               # tests in watch mode
npm run generate-fixtures        # regenerate test fixtures
npm run http                     # start HTTP server
npm run electron                 # start Electron desktop app
```

## Version Roadmap

| Version | Capability | Status |
|---------|-----------|--------|
| v1 | Read & Summarize | **Done** |
| v2 | Audit & Validate | **Done** |
| v3 | Safe Database Mutation | **Done** |
| v4 | Events, Maps & Plugins | **Done** |
| v5 | In-Engine Integration | **Done** |
| v6 | Full Surface (HTTP API, MZ adapter, Advanced Events, Electron) | **In Progress** |
