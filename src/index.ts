import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { loadProject } from "./io/project.js";
import { logger } from "./log.js";
import {
  GetEntityInput,
  GetMapEventsInput,
  GetProjectStatusInput,
  ListEntitiesInput,
  ListMapsInput,
  ListPluginsInput,
  ListProjectDataInput,
  SearchEventsInput,
  SearchNotesInput,
  ValidateProjectRefsInput,
  getEntity,
  getMapEvents,
  getProjectStatus,
  listEntities,
  listMaps,
  listPlugins,
  listProjectData,
  searchEvents,
  searchNotes,
  validateProjectRefs,
} from "./tools/index.js";

const TOOL_DEFS = [
  {
    name: "get_project_status",
    description: "Get project health and identity",
    inputSchema: GetProjectStatusInput,
    handler: getProjectStatus,
  },
  {
    name: "list_project_data",
    description: "List entity counts, map count, plugin count",
    inputSchema: ListProjectDataInput,
    handler: listProjectData,
  },
  {
    name: "list_entities",
    description: "List database entities by type with optional query/limit/offset",
    inputSchema: ListEntitiesInput,
    handler: listEntities,
  },
  {
    name: "get_entity",
    description: "Get a full database entity by type and id",
    inputSchema: GetEntityInput,
    handler: getEntity,
  },
  {
    name: "list_maps",
    description: "List all maps with id, name, parentId, order",
    inputSchema: ListMapsInput,
    handler: listMaps,
  },
  {
    name: "get_map_events",
    description: "Get event summaries for a map",
    inputSchema: GetMapEventsInput,
    handler: getMapEvents,
  },
  {
    name: "search_events",
    description: "Search event text (show-text, comments, scripts)",
    inputSchema: SearchEventsInput,
    handler: searchEvents,
  },
  {
    name: "search_notes",
    description: "Search note fields and meta",
    inputSchema: SearchNotesInput,
    handler: searchNotes,
  },
  {
    name: "list_plugins",
    description: "List plugins from plugins.js",
    inputSchema: ListPluginsInput,
    handler: listPlugins,
  },
  {
    name: "validate_project_refs",
    description: "Audit project for broken references, dangling IDs, and integrity issues",
    inputSchema: ValidateProjectRefsInput,
    handler: validateProjectRefs,
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
    { name: "rpgmv-bridge", version: "0.1.0" },
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
      const result = def.handler(project, parsed as never);
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
