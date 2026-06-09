import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { type Project, loadProject } from "../io/project.js";
import { logger } from "../log.js";
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
} from "../tools/index.js";

const MUTATING_TOOLS = new Set([
  "create_item_draft",
  "create_skill_draft",
  "create_entity_draft",
  "update_entity_draft",
  "create_common_event_draft",
  "create_map_event_draft",
  "update_map_event_draft",
  "set_plugin_param_draft",
  "add_plugin_draft",
  "discard_pending_changes",
  "apply_patch",
  "rollback_last_patch",
]);

// Simple async mutex for serializing mutation requests
let mutationQueue: Promise<void> = Promise.resolve();

async function serializeMutation<T>(fn: () => Promise<T>): Promise<T> {
  const previousQueue = mutationQueue;
  let resolveNext!: () => void;
  mutationQueue = new Promise<void>((resolve) => {
    resolveNext = resolve;
  });
  await previousQueue;
  try {
    return await fn();
  } finally {
    resolveNext();
  }
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    safeParse: (
      data: unknown,
    ) =>
      | { success: true; data: unknown }
      | { success: false; error: { issues: Array<{ message: string }> } };
  };
  handler: (project: Project, args: unknown) => unknown | Promise<unknown>;
}

const TOOL_DEFS: ToolDef[] = [
  {
    name: "get_project_status",
    description: "Get project health and identity",
    inputSchema: GetProjectStatusInput,
    handler: (p) => getProjectStatus(p),
  },
  {
    name: "list_project_data",
    description: "List entity counts",
    inputSchema: ListProjectDataInput,
    handler: (p) => listProjectData(p),
  },
  {
    name: "list_entities",
    description: "List database entities by type",
    inputSchema: ListEntitiesInput,
    handler: (p, a) => listEntities(p, a as never),
  },
  {
    name: "get_entity",
    description: "Get a full database entity by type and id",
    inputSchema: GetEntityInput,
    handler: (p, a) => getEntity(p, a as never),
  },
  {
    name: "list_maps",
    description: "List all maps",
    inputSchema: ListMapsInput,
    handler: (p) => listMaps(p),
  },
  {
    name: "get_map_events",
    description: "Get event summaries for a map",
    inputSchema: GetMapEventsInput,
    handler: (p, a) => getMapEvents(p, a as never),
  },
  {
    name: "search_events",
    description: "Search event text",
    inputSchema: SearchEventsInput,
    handler: (p, a) => searchEvents(p, a as never),
  },
  {
    name: "search_notes",
    description: "Search note fields/meta",
    inputSchema: SearchNotesInput,
    handler: (p, a) => searchNotes(p, a as never),
  },
  {
    name: "list_plugins",
    description: "List plugins",
    inputSchema: ListPluginsInput,
    handler: (p) => listPlugins(p),
  },
  {
    name: "validate_project_refs",
    description: "Validate project references",
    inputSchema: ValidateProjectRefsInput,
    handler: (p) => validateProjectRefs(p),
  },
  {
    name: "create_item_draft",
    description: "Draft a new item",
    inputSchema: CreateItemDraftInput,
    handler: (p, a) => createItemDraft(p, p.staging, a as never),
  },
  {
    name: "create_skill_draft",
    description: "Draft a new skill",
    inputSchema: CreateSkillDraftInput,
    handler: (p, a) => createSkillDraft(p, p.staging, a as never),
  },
  {
    name: "create_entity_draft",
    description: "Draft a new entity",
    inputSchema: CreateEntityDraftInput,
    handler: (p, a) => createEntityDraft(p, p.staging, a as never),
  },
  {
    name: "update_entity_draft",
    description: "Update an entity draft",
    inputSchema: UpdateEntityDraftInput,
    handler: (p, a) => updateEntityDraft(p, p.staging, a as never),
  },
  {
    name: "list_pending_changes",
    description: "List pending changes",
    inputSchema: ListPendingChangesInput,
    handler: (p) => listPendingChanges(p, p.staging),
  },
  {
    name: "diff_pending_changes",
    description: "Show diff of pending changes",
    inputSchema: DiffPendingChangesInput,
    handler: (p) => diffPendingChanges(p, p.staging),
  },
  {
    name: "discard_pending_changes",
    description: "Discard pending changes",
    inputSchema: DiscardPendingChangesInput,
    handler: (p, a) => discardPendingChanges(p, p.staging, a as never),
  },
  {
    name: "apply_patch",
    description: "Apply all pending changes",
    inputSchema: ApplyPatchInput,
    handler: (p, a) => applyPatchTool(p, p.staging, a as never),
  },
  {
    name: "rollback_last_patch",
    description: "Rollback last transaction",
    inputSchema: RollbackLastPatchInput,
    handler: (p) => rollbackLastPatchTool(p),
  },
  {
    name: "list_backups",
    description: "List backup transactions",
    inputSchema: ListBackupsInput,
    handler: (p) => listBackups(p),
  },
  {
    name: "create_common_event_draft",
    description: "Draft a common event",
    inputSchema: CreateCommonEventDraftInput,
    handler: (p, a) => createCommonEventDraft(p, p.staging, a as never),
  },
  {
    name: "create_map_event_draft",
    description: "Draft a map event",
    inputSchema: CreateMapEventDraftInput,
    handler: (p, a) => createMapEventDraft(p, p.staging, a as never),
  },
  {
    name: "update_map_event_draft",
    description: "Update a map event draft",
    inputSchema: UpdateMapEventDraftInput,
    handler: (p, a) => updateMapEventDraft(p, p.staging, a as never),
  },
  {
    name: "set_plugin_param_draft",
    description: "Set plugin params",
    inputSchema: SetPluginParamDraftInput,
    handler: (p, a) => setPluginParamDraft(p, p.staging, a as never),
  },
  {
    name: "add_plugin_draft",
    description: "Add a new plugin",
    inputSchema: AddPluginDraftInput,
    handler: (p, a) => addPluginDraft(p, p.staging, a as never),
  },
  {
    name: "inspect_runtime",
    description: "Inspect runtime state",
    inputSchema: InspectRuntimeInput,
    handler: (p, a) => inspectRuntime(p, a as never),
  },
  {
    name: "preview_entity",
    description: "Preview an entity in-game",
    inputSchema: PreviewEntityInput,
    handler: (p, a) => previewEntity(p, a as never),
  },
];

export async function startHttpServer(port = 8866, host = "127.0.0.1") {
  const fastify = Fastify({ logger: false });

  const projectDir = process.env.RPGMV_PROJECT_DIR;
  if (!projectDir) {
    throw new Error("RPGMV_PROJECT_DIR environment variable not set");
  }
  const project = loadProject(projectDir);

  fastify.get("/tools", async () => {
    return { tools: TOOL_DEFS.map((t) => ({ name: t.name, description: t.description })) };
  });

  fastify.get("/api/tools", async () => {
    return { tools: TOOL_DEFS.map((t) => ({ name: t.name, description: t.description })) };
  });

  for (const def of TOOL_DEFS) {
    const routeHandler = async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = def.inputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          ok: false,
          error: parsed.error.issues.map((i) => i.message).join("; "),
        });
      }
      try {
        const handle = () => def.handler(project, parsed.data);
        const result = MUTATING_TOOLS.has(def.name)
          ? await serializeMutation(handle as () => Promise<unknown>)
          : await handle();
        return { ok: true, result };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ tool: def.name, error: message }, "Tool error");
        return reply.status(500).send({ ok: false, error: message });
      }
    };
    fastify.post(`/tools/${def.name}`, routeHandler);
    fastify.post(`/api/tools/${def.name}`, routeHandler);
  }

  await fastify.listen({ port, host });
  logger.info({ port, host }, "HTTP server started");
  return fastify;
}

// CLI entry point: auto-start when run directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  const port = Number(process.env.HTTP_PORT ?? 8866);
  const host = process.env.HTTP_HOST ?? "127.0.0.1";
  startHttpServer(port, host).catch((err) => {
    logger.error({ err }, "Failed to start HTTP server");
    process.exit(1);
  });
}
