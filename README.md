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

# Audit project for broken references and integrity issues
npx tsx src/cli.ts validate path/to/your/project

# List pending draft changes
npx tsx src/cli.ts pending path/to/your/project

# Show JSON Patch diff of pending changes
npx tsx src/cli.ts diff path/to/your/project

# Discard all pending draft changes
npx tsx src/cli.ts discard path/to/your/project

# Apply all pending changes (creates backups)
npx tsx src/cli.ts apply path/to/your/project

# Rollback the last applied transaction
npx tsx src/cli.ts rollback path/to/your/project

# List all backup transactions
npx tsx src/cli.ts backups path/to/your/project
```

### MCP Server (for AI clients)

```bash
# Set the project directory and start the MCP stdio server
RPGMV_PROJECT_DIR=path/to/your/project npx tsx src/index.ts
```

The MCP server exposes 20 tools: `get_project_status`, `list_project_data`, `list_entities`, `get_entity`, `list_maps`, `get_map_events`, `search_events`, `search_notes`, `list_plugins`, `validate_project_refs`, `create_item_draft`, `create_skill_draft`, `create_entity_draft`, `update_entity_draft`, `list_pending_changes`, `diff_pending_changes`, `discard_pending_changes`, `apply_patch`, `rollback_last_patch`, `list_backups`.

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
| v2 | Audit & Validate | **Done** |
| v3 | Safe Database Mutation | **Done** |
| v4 | Events, Maps & Plugins | Next |
| v5 | In-Engine Integration | Planned |
| v6 | Full Surface (HTTP/UI, MZ, Electron) | Planned |
