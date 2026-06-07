import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { join } from "node:path";
import { loadProject } from "../../src/io/project.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  GetProjectStatusInput, getProjectStatus,
  ListProjectDataInput, listProjectData,
  ListEntitiesInput, listEntities,
  GetEntityInput, getEntity,
  ListMapsInput, listMaps,
  GetMapEventsInput, getMapEvents,
  SearchEventsInput, searchEvents,
  SearchNotesInput, searchNotes,
  ListPluginsInput, listPlugins,
} from "../../src/tools/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const SAMPLE_DIR = join(process.cwd(), "test", "fixtures", "sample-project");

const TOOL_DEFS = [
  { name: "get_project_status", inputSchema: GetProjectStatusInput, handler: getProjectStatus },
  { name: "list_project_data", inputSchema: ListProjectDataInput, handler: listProjectData },
  { name: "list_entities", inputSchema: ListEntitiesInput, handler: listEntities },
  { name: "get_entity", inputSchema: GetEntityInput, handler: getEntity },
  { name: "list_maps", inputSchema: ListMapsInput, handler: listMaps },
  { name: "get_map_events", inputSchema: GetMapEventsInput, handler: getMapEvents },
  { name: "search_events", inputSchema: SearchEventsInput, handler: searchEvents },
  { name: "search_notes", inputSchema: SearchNotesInput, handler: searchNotes },
  { name: "list_plugins", inputSchema: ListPluginsInput, handler: listPlugins },
];

describe("MCP contract tests", () => {
  let client: Client;
  let server: Server;

  beforeAll(async () => {
    const project = loadProject(SAMPLE_DIR);

    server = new Server(
      { name: "rpgmv-bridge-test", version: "0.1.0" },
      { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOL_DEFS.map((t) => ({
        name: t.name,
        description: t.name,
        inputSchema: zodToJsonSchema(t.inputSchema),
      })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const def = TOOL_DEFS.find((t) => t.name === name);
      if (!def) {
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
      }
      try {
        const parsed = def.inputSchema.parse(args ?? {});
        const result = def.handler(project, parsed as never);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (err) {
        return { content: [{ type: "text", text: String(err) }], isError: true };
      }
    });

    client = new Client({ name: "test-client", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
    await server.close();
  });

  it("lists all 9 v1 tools", async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(9);
    const names = result.tools.map((t) => t.name);
    expect(names).toContain("get_project_status");
    expect(names).toContain("list_project_data");
    expect(names).toContain("list_entities");
    expect(names).toContain("get_entity");
    expect(names).toContain("list_maps");
    expect(names).toContain("get_map_events");
    expect(names).toContain("search_events");
    expect(names).toContain("search_notes");
    expect(names).toContain("list_plugins");
  });

  it("get_project_status returns correct shape", async () => {
    const result = await client.callTool({ name: "get_project_status", arguments: {} });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.gameTitle).toBe("Sample Game");
    expect(data.engine).toBe("mv");
  });

  it("list_project_data returns entity counts", async () => {
    const result = await client.callTool({ name: "list_project_data", arguments: {} });
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.counts.Item).toBe(3);
    expect(data.counts.Skill).toBe(3);
    expect(data.mapCount).toBe(1);
  });

  it("list_entities returns items", async () => {
    const result = await client.callTool({ name: "list_entities", arguments: { type: "Item" } });
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.total).toBe(3);
    expect(data.items[0].name).toBe("Potion");
  });

  it("list_entities supports query filter", async () => {
    const result = await client.callTool({ name: "list_entities", arguments: { type: "Item", query: "potion" } });
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.total).toBe(1);
  });

  it("get_entity returns full entity", async () => {
    const result = await client.callTool({ name: "get_entity", arguments: { type: "Item", id: 1 } });
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.entity.name).toBe("Potion");
    expect(data.meta.type).toBe("healing");
  });

  it("get_entity returns error for missing entity", async () => {
    const result = await client.callTool({ name: "get_entity", arguments: { type: "Item", id: 999 } });
    expect(result.isError).toBe(true);
  });

  it("list_maps returns maps", async () => {
    const result = await client.callTool({ name: "list_maps", arguments: {} });
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.maps).toHaveLength(1);
    expect(data.maps[0].name).toBe("Start Map");
  });

  it("get_map_events returns events", async () => {
    const result = await client.callTool({ name: "get_map_events", arguments: { mapId: 1 } });
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.events).toHaveLength(1);
    expect(data.events[0].name).toBe("NPC");
  });

  it("search_events finds text", async () => {
    const result = await client.callTool({ name: "search_events", arguments: { query: "Hello" } });
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0].snippet).toBe("Hello, adventurer!");
  });

  it("search_notes finds notes", async () => {
    const result = await client.callTool({ name: "search_notes", arguments: { query: "type" } });
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0].name).toBe("Potion");
  });

  it("list_plugins returns plugins", async () => {
    const result = await client.callTool({ name: "list_plugins", arguments: {} });
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.plugins).toHaveLength(1);
    expect(data.plugins[0].name).toBe("SamplePlugin");
  });
});
