import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { loadProject } from "./io/project.js";
import { logger } from "./log.js";
import {
  AddPluginDraftInput,
  ApplyPatchInput,
  CreateCommonEventDraftInput,
  CreateEntityDraftInput,
  CreateItemDraftInput,
  CreateMapEventDraftInput,
  CreateSkillDraftInput,
  DiffPendingChangesInput,
  DiscardPendingChangesInput,
  GetEntityInput,
  GetMapEventsInput,
  GetProjectStatusInput,
  InspectRuntimeInput,
  ListBackupsInput,
  ListEntitiesInput,
  ListMapsInput,
  ListPendingChangesInput,
  ListPluginsInput,
  ListProjectDataInput,
  PreviewEntityInput,
  RollbackLastPatchInput,
  SearchEventsInput,
  SearchNotesInput,
  SetPluginParamDraftInput,
  UpdateEntityDraftInput,
  UpdateMapEventDraftInput,
  ValidateProjectRefsInput,
  addPluginDraft,
  applyPatchTool,
  createCommonEventDraft,
  createEntityDraft,
  createItemDraft,
  createMapEventDraft,
  createSkillDraft,
  diffPendingChanges,
  discardPendingChanges,
  getEntity,
  getMapEvents,
  getProjectStatus,
  inspectRuntime,
  listBackups,
  listEntities,
  listMaps,
  listPendingChanges,
  listPlugins,
  listProjectData,
  previewEntity,
  rollbackLastPatchTool,
  searchEvents,
  searchNotes,
  setPluginParamDraft,
  updateEntityDraft,
  updateMapEventDraft,
  validateProjectRefs,
} from "./tools/index.js";

const TOOL_DEFS = [
  {
    name: "get_project_status",
    description: "Get project health and identity",
    inputSchema: GetProjectStatusInput,
    handler: (p: ReturnType<typeof loadProject>) => getProjectStatus(p),
  },
  {
    name: "list_project_data",
    description: "List entity counts, map count, plugin count",
    inputSchema: ListProjectDataInput,
    handler: (p: ReturnType<typeof loadProject>) => listProjectData(p),
  },
  {
    name: "list_entities",
    description: "List database entities by type with optional query/limit/offset",
    inputSchema: ListEntitiesInput,
    handler: (p: ReturnType<typeof loadProject>, args: unknown) => listEntities(p, args as never),
  },
  {
    name: "get_entity",
    description: "Get a full database entity by type and id",
    inputSchema: GetEntityInput,
    handler: (p: ReturnType<typeof loadProject>, args: unknown) => getEntity(p, args as never),
  },
  {
    name: "list_maps",
    description: "List all maps with id, name, parentId, order",
    inputSchema: ListMapsInput,
    handler: (p: ReturnType<typeof loadProject>) => listMaps(p),
  },
  {
    name: "get_map_events",
    description: "Get event summaries for a map",
    inputSchema: GetMapEventsInput,
    handler: (p: ReturnType<typeof loadProject>, args: unknown) => getMapEvents(p, args as never),
  },
  {
    name: "search_events",
    description: "Search event text (show-text, comments, scripts)",
    inputSchema: SearchEventsInput,
    handler: (p: ReturnType<typeof loadProject>, args: unknown) => searchEvents(p, args as never),
  },
  {
    name: "search_notes",
    description: "Search note fields and meta",
    inputSchema: SearchNotesInput,
    handler: (p: ReturnType<typeof loadProject>, args: unknown) => searchNotes(p, args as never),
  },
  {
    name: "list_plugins",
    description: "List plugins from plugins.js",
    inputSchema: ListPluginsInput,
    handler: (p: ReturnType<typeof loadProject>) => listPlugins(p),
  },
  {
    name: "validate_project_refs",
    description: "Audit project for broken references, dangling IDs, and integrity issues",
    inputSchema: ValidateProjectRefsInput,
    handler: (p: ReturnType<typeof loadProject>) => validateProjectRefs(p),
  },
  {
    name: "create_item_draft",
    description: "Draft a new item for creation",
    inputSchema: CreateItemDraftInput,
    handler: (p: ReturnType<typeof loadProject>, args: unknown) =>
      createItemDraft(p, p.staging, args as never),
  },
  {
    name: "create_skill_draft",
    description: "Draft a new skill for creation",
    inputSchema: CreateSkillDraftInput,
    handler: (p: ReturnType<typeof loadProject>, args: unknown) =>
      createSkillDraft(p, p.staging, args as never),
  },
  {
    name: "create_entity_draft",
    description: "Draft a new entity of any type for creation",
    inputSchema: CreateEntityDraftInput,
    handler: (p: ReturnType<typeof loadProject>, args: unknown) =>
      createEntityDraft(p, p.staging, args as never),
  },
  {
    name: "update_entity_draft",
    description: "Draft an update to an existing entity",
    inputSchema: UpdateEntityDraftInput,
    handler: (p: ReturnType<typeof loadProject>, args: unknown) =>
      updateEntityDraft(p, p.staging, args as never),
  },
  {
    name: "list_pending_changes",
    description: "List all pending draft changes",
    inputSchema: ListPendingChangesInput,
    handler: (p: ReturnType<typeof loadProject>) => listPendingChanges(p, p.staging),
  },
  {
    name: "diff_pending_changes",
    description: "Show JSON Patch diff of pending changes",
    inputSchema: DiffPendingChangesInput,
    handler: (p: ReturnType<typeof loadProject>) => diffPendingChanges(p, p.staging),
  },
  {
    name: "discard_pending_changes",
    description: "Discard pending draft changes",
    inputSchema: DiscardPendingChangesInput,
    handler: (p: ReturnType<typeof loadProject>, args: unknown) =>
      discardPendingChanges(p, p.staging, args as never),
  },
  {
    name: "apply_patch",
    description: "Apply all pending changes (requires confirm: true)",
    inputSchema: ApplyPatchInput,
    handler: async (p: ReturnType<typeof loadProject>, args: unknown) =>
      applyPatchTool(p, p.staging, args as never),
  },
  {
    name: "rollback_last_patch",
    description: "Rollback the last applied transaction",
    inputSchema: RollbackLastPatchInput,
    handler: (p: ReturnType<typeof loadProject>) => rollbackLastPatchTool(p),
  },
  {
    name: "list_backups",
    description: "List all backup transactions",
    inputSchema: ListBackupsInput,
    handler: (p: ReturnType<typeof loadProject>) => listBackups(p),
  },
  {
    name: "create_common_event_draft",
    description: "Draft a new common event with constrained commands",
    inputSchema: CreateCommonEventDraftInput,
    handler: (p: ReturnType<typeof loadProject>, args: unknown) =>
      createCommonEventDraft(p, p.staging, args as never),
  },
  {
    name: "create_map_event_draft",
    description: "Draft a new map event with constrained commands",
    inputSchema: CreateMapEventDraftInput,
    handler: (p: ReturnType<typeof loadProject>, args: unknown) =>
      createMapEventDraft(p, p.staging, args as never),
  },
  {
    name: "update_map_event_draft",
    description: "Draft an update to an existing map event",
    inputSchema: UpdateMapEventDraftInput,
    handler: (p: ReturnType<typeof loadProject>, args: unknown) =>
      updateMapEventDraft(p, p.staging, args as never),
  },
  {
    name: "set_plugin_param_draft",
    description: "Draft parameter changes for an existing plugin",
    inputSchema: SetPluginParamDraftInput,
    handler: (p: ReturnType<typeof loadProject>, args: unknown) =>
      setPluginParamDraft(p, p.staging, args as never),
  },
  {
    name: "add_plugin_draft",
    description: "Draft a new plugin with source code",
    inputSchema: AddPluginDraftInput,
    handler: (p: ReturnType<typeof loadProject>, args: unknown) =>
      addPluginDraft(p, p.staging, args as never),
  },
  {
    name: "inspect_runtime",
    description: "Inspect runtime state from a running game with BridgeInspector plugin",
    inputSchema: InspectRuntimeInput,
    handler: async (p: ReturnType<typeof loadProject>, args: unknown) =>
      inspectRuntime(p, args as never),
  },
  {
    name: "preview_entity",
    description: "Preview an item or skill in a running game with BridgeInspector plugin",
    inputSchema: PreviewEntityInput,
    handler: async (p: ReturnType<typeof loadProject>, args: unknown) =>
      previewEntity(p, args as never),
  },
] as const;

function getProjectDir(): string {
  const dir = process.env.RPGMV_PROJECT_DIR;
  if (!dir) {
    logger.error("RPGMV_PROJECT_DIR environment variable not set");
    process.exit(1);
  }
  return dir;
}

async function main() {
  const projectDir = getProjectDir();
  const project = loadProject(projectDir);

  const server = new Server(
    { name: "rpgmv-bridge", version: "0.3.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOL_DEFS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: zodToJsonSchema(t.inputSchema),
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const def = TOOL_DEFS.find((t) => t.name === name);
    if (!def) {
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }

    try {
      const parsed = def.inputSchema.parse(args ?? {});
      const result = await def.handler(project, parsed as never);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ tool: name, error: message }, "Tool error");
      return { content: [{ type: "text", text: message }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server started");
}

main().catch((err) => {
  logger.error({ err }, "Fatal error");
  process.exit(1);
});
