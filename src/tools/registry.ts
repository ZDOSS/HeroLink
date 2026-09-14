import type { z } from "zod";
import { ConflictError } from "../errors.js";
import { withProjectLock } from "../io/lock.js";
import type { Project } from "../io/project.js";
import { reloadModel } from "../model/normalized.js";
import { recoverInterruptedTransaction } from "../mutate/apply.js";
import { prepareCandidate } from "../mutate/candidate.js";
import { assertSafeKeys } from "../schema/safety.js";
import {
  AddPluginDraftInput,
  AddPluginDraftOutput,
  ApplyPatchInput,
  ApplyPatchOutput,
  CreateCommonEventDraftInput,
  CreateCommonEventDraftOutput,
  CreateEntityDraftInput,
  CreateEntityDraftOutput,
  CreateItemDraftInput,
  CreateItemDraftOutput,
  CreateMapEventDraftInput,
  CreateMapEventDraftOutput,
  CreateSkillDraftInput,
  CreateSkillDraftOutput,
  DiffPendingChangesInput,
  DiffPendingChangesOutput,
  DiscardPendingChangesInput,
  DiscardPendingChangesOutput,
  GetEntityInput,
  GetEntityOutput,
  GetMapEventsInput,
  GetMapEventsOutput,
  GetProjectStatusInput,
  GetProjectStatusOutput,
  InspectRuntimeInput,
  InspectRuntimeOutput,
  ListBackupsInput,
  ListBackupsOutput,
  ListEntitiesInput,
  ListEntitiesOutput,
  ListMapsInput,
  ListMapsOutput,
  ListPendingChangesInput,
  ListPendingChangesOutput,
  ListPluginsInput,
  ListPluginsOutput,
  ListProjectDataInput,
  ListProjectDataOutput,
  PreviewEntityInput,
  PreviewEntityOutput,
  RollbackLastPatchInput,
  RollbackLastPatchOutput,
  SearchEventsInput,
  SearchEventsOutput,
  SearchNotesInput,
  SearchNotesOutput,
  SetPluginParamDraftInput,
  SetPluginParamDraftOutput,
  UpdateEntityDraftInput,
  UpdateEntityDraftOutput,
  UpdateMapEventDraftInput,
  UpdateMapEventDraftOutput,
  ValidateProjectRefsInput,
  ValidateProjectRefsOutput,
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
} from "./index.js";
export interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  handler: (project: Project, args: unknown) => unknown | Promise<unknown>;
}
export const TOOL_DEFS: ToolDef[] = [
  {
    name: "get_project_status",
    description: "Get project health and identity",
    inputSchema: GetProjectStatusInput,
    outputSchema: GetProjectStatusOutput,
    handler: (p) => getProjectStatus(p),
  },
  {
    name: "list_project_data",
    description: "List entity counts",
    inputSchema: ListProjectDataInput,
    outputSchema: ListProjectDataOutput,
    handler: (p) => listProjectData(p),
  },
  {
    name: "list_entities",
    description: "List database entities by type",
    inputSchema: ListEntitiesInput,
    outputSchema: ListEntitiesOutput,
    handler: (p, a) => listEntities(p, ListEntitiesInput.parse(a)),
  },
  {
    name: "get_entity",
    description: "Get a full database entity by type and id",
    inputSchema: GetEntityInput,
    outputSchema: GetEntityOutput,
    handler: (p, a) => getEntity(p, GetEntityInput.parse(a)),
  },
  {
    name: "list_maps",
    description: "List all maps",
    inputSchema: ListMapsInput,
    outputSchema: ListMapsOutput,
    handler: (p) => listMaps(p),
  },
  {
    name: "get_map_events",
    description: "Get event summaries for a map",
    inputSchema: GetMapEventsInput,
    outputSchema: GetMapEventsOutput,
    handler: (p, a) => getMapEvents(p, GetMapEventsInput.parse(a)),
  },
  {
    name: "search_events",
    description: "Search event text",
    inputSchema: SearchEventsInput,
    outputSchema: SearchEventsOutput,
    handler: (p, a) => searchEvents(p, SearchEventsInput.parse(a)),
  },
  {
    name: "search_notes",
    description: "Search note fields/meta",
    inputSchema: SearchNotesInput,
    outputSchema: SearchNotesOutput,
    handler: (p, a) => searchNotes(p, SearchNotesInput.parse(a)),
  },
  {
    name: "list_plugins",
    description: "List plugins",
    inputSchema: ListPluginsInput,
    outputSchema: ListPluginsOutput,
    handler: (p) => listPlugins(p),
  },
  {
    name: "validate_project_refs",
    description: "Validate project references",
    inputSchema: ValidateProjectRefsInput,
    outputSchema: ValidateProjectRefsOutput,
    handler: (p, a) => validateProjectRefs(p, ValidateProjectRefsInput.parse(a)),
  },
  {
    name: "create_item_draft",
    description: "Draft a new item",
    inputSchema: CreateItemDraftInput,
    outputSchema: CreateItemDraftOutput,
    handler: (p, a) => createItemDraft(p, p.staging, CreateItemDraftInput.parse(a)),
  },
  {
    name: "create_skill_draft",
    description: "Draft a new skill",
    inputSchema: CreateSkillDraftInput,
    outputSchema: CreateSkillDraftOutput,
    handler: (p, a) => createSkillDraft(p, p.staging, CreateSkillDraftInput.parse(a)),
  },
  {
    name: "create_entity_draft",
    description: "Draft a new entity",
    inputSchema: CreateEntityDraftInput,
    outputSchema: CreateEntityDraftOutput,
    handler: (p, a) => createEntityDraft(p, p.staging, CreateEntityDraftInput.parse(a)),
  },
  {
    name: "update_entity_draft",
    description: "Update an entity draft",
    inputSchema: UpdateEntityDraftInput,
    outputSchema: UpdateEntityDraftOutput,
    handler: (p, a) => updateEntityDraft(p, p.staging, UpdateEntityDraftInput.parse(a)),
  },
  {
    name: "list_pending_changes",
    description: "List pending changes",
    inputSchema: ListPendingChangesInput,
    outputSchema: ListPendingChangesOutput,
    handler: (p) => listPendingChanges(p, p.staging),
  },
  {
    name: "diff_pending_changes",
    description: "Show diff of pending changes",
    inputSchema: DiffPendingChangesInput,
    outputSchema: DiffPendingChangesOutput,
    handler: (p) => diffPendingChanges(p, p.staging),
  },
  {
    name: "discard_pending_changes",
    description: "Discard pending changes",
    inputSchema: DiscardPendingChangesInput,
    outputSchema: DiscardPendingChangesOutput,
    handler: (p, a) => discardPendingChanges(p, p.staging, DiscardPendingChangesInput.parse(a)),
  },
  {
    name: "apply_patch",
    description: "Apply all pending changes",
    inputSchema: ApplyPatchInput,
    outputSchema: ApplyPatchOutput,
    handler: (p, a) => applyPatchTool(p, p.staging, ApplyPatchInput.parse(a)),
  },
  {
    name: "rollback_last_patch",
    description: "Rollback last transaction",
    inputSchema: RollbackLastPatchInput,
    outputSchema: RollbackLastPatchOutput,
    handler: (p) => rollbackLastPatchTool(p),
  },
  {
    name: "list_backups",
    description: "List backup transactions",
    inputSchema: ListBackupsInput,
    outputSchema: ListBackupsOutput,
    handler: (p) => listBackups(p),
  },
  {
    name: "create_common_event_draft",
    description: "Draft a common event",
    inputSchema: CreateCommonEventDraftInput,
    outputSchema: CreateCommonEventDraftOutput,
    handler: (p, a) => createCommonEventDraft(p, p.staging, CreateCommonEventDraftInput.parse(a)),
  },
  {
    name: "create_map_event_draft",
    description: "Draft a map event",
    inputSchema: CreateMapEventDraftInput,
    outputSchema: CreateMapEventDraftOutput,
    handler: (p, a) => createMapEventDraft(p, p.staging, CreateMapEventDraftInput.parse(a)),
  },
  {
    name: "update_map_event_draft",
    description: "Update a map event draft",
    inputSchema: UpdateMapEventDraftInput,
    outputSchema: UpdateMapEventDraftOutput,
    handler: (p, a) => updateMapEventDraft(p, p.staging, UpdateMapEventDraftInput.parse(a)),
  },
  {
    name: "set_plugin_param_draft",
    description: "Set plugin params",
    inputSchema: SetPluginParamDraftInput,
    outputSchema: SetPluginParamDraftOutput,
    handler: (p, a) => setPluginParamDraft(p, p.staging, SetPluginParamDraftInput.parse(a)),
  },
  {
    name: "add_plugin_draft",
    description: "Add a new plugin",
    inputSchema: AddPluginDraftInput,
    outputSchema: AddPluginDraftOutput,
    handler: (p, a) => addPluginDraft(p, p.staging, AddPluginDraftInput.parse(a)),
  },
  {
    name: "inspect_runtime",
    description: "Inspect runtime state",
    inputSchema: InspectRuntimeInput,
    outputSchema: InspectRuntimeOutput,
    handler: (p, a) => inspectRuntime(p, InspectRuntimeInput.parse(a)),
  },
  {
    name: "preview_entity",
    description: "Preview an entity in-game",
    inputSchema: PreviewEntityInput,
    outputSchema: PreviewEntityOutput,
    handler: (p, a) => previewEntity(p, PreviewEntityInput.parse(a)),
  },
];

export async function callTool(
  project: Project,
  name: string,
  args: unknown = {},
): Promise<unknown> {
  const def = TOOL_DEFS.find((t) => t.name === name);
  if (!def) throw new ConflictError(`Unknown tool: ${name}`);
  // Check keys before schema normalization can omit special properties.
  assertSafeKeys(args);
  const input = def.inputSchema.parse(args);
  const result = await withProjectLock(project.projectDir, () => {
    recoverInterruptedTransaction(project.projectDir);
    // Every transport can outlive another session's apply followed by new drafts.
    // Refresh the model independently; the persisted staging baseline still
    // refuses external edits and is never replaced by this reload.
    reloadModel(project.model);
    const before = project.staging.read();
    try {
      const output = def.handler(project, input);
      if (name.endsWith("_draft")) {
        const candidate = prepareCandidate(project, project.staging);
        if (!output || typeof output !== "object")
          throw new Error("Draft handler returned no result");
        return {
          ...output,
          validation: {
            ok: candidate.validation.ok,
            issues: candidate.validation.issues.map((i) => `${i.location}: ${i.message}`),
          },
        };
      }
      return output;
    } catch (error) {
      if (name.endsWith("_draft") && project.staging.read().revision !== before.revision)
        project.staging.restore(before);
      throw error;
    }
  });
  def.outputSchema.parse(result);
  return result;
}
