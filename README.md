# RPG Maker MV Content Bridge

A local, file-based bridge that lets an AI client read, draft, validate, and safely write content into an RPG Maker MV project.

## Quick Start

### CLI (read-only, v1)

```bash
# Project status
npx tsx src/cli.ts status path/to/your/project

# List entity counts
npx tsx src/cli.ts data path/to/your/project

# List items
npx tsx src/cli.ts list path/to/your/project Item

# Search items by name
npx tsx src/cli.ts list path/to/your/project Item --query potion

# Get a specific entity
npx tsx src/cli.ts get path/to/your/project Item 1

# List maps
npx tsx src/cli.ts maps path/to/your/project

# Get map events
npx tsx src/cli.ts events path/to/your/project 1

# Search event text (show-text, comments, scripts)
npx tsx src/cli.ts search path/to/your/project "hello"

# Search notes/meta
npx tsx src/cli.ts notes path/to/your/project "type"

# List plugins
npx tsx src/cli.ts plugins path/to/your/project
```

### MCP Server (for AI clients)

```bash
# Set the project directory and start the MCP stdio server
RPGMV_PROJECT_DIR=path/to/your/project npx tsx src/index.ts
```

The MCP server exposes 9 read-only tools: `get_project_status`, `list_project_data`, `list_entities`, `get_entity`, `list_maps`, `get_map_events`, `search_events`, `search_notes`, `list_plugins`.

## Development

```bash
npm install
npm run check          # lint + typecheck + tests + coverage
npm run test           # tests only
npm run test:watch     # tests in watch mode
npm run generate-fixtures  # regenerate test fixtures
```

## Version Roadmap

| Version | Capability | Status |
|---------|-----------|--------|
| v1 | Read & Summarize | **Done** |
| v2 | Audit & Validate | Next |
| v3 | Safe Database Mutation | Planned |
| v4 | Events, Maps & Plugins | Planned |
| v5 | In-Engine Integration | Planned |
| v6 | Full Surface (HTTP/UI, MZ, Electron) | Planned |
