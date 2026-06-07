import { z } from "zod";
import type { Project } from "../io/project.js";
import type { Staging } from "../mutate/staging.js";
import { ConstrainedCommandSchema, compileCommandList } from "../schema/commands.js";

export const CreateCommonEventDraftInput = z.object({
  name: z.string().min(1),
  trigger: z.number().int().min(0).max(2).default(0),
  switchId: z.number().int().positive().default(1),
  commands: z.array(ConstrainedCommandSchema).min(1),
});

export const CreateCommonEventDraftOutput = z.object({
  changeId: z.string(),
  preview: z.object({
    entityType: z.string(),
    fields: z.record(z.unknown()),
  }),
  validation: z.object({
    ok: z.boolean(),
    issues: z.array(z.string()).optional(),
  }),
});

export function createCommonEventDraft(
  project: Project,
  staging: Staging,
  input: z.infer<typeof CreateCommonEventDraftInput>,
) {
  const eventCommands = compileCommandList(input.commands);

  const fields = {
    name: input.name,
    trigger: input.trigger,
    switchId: input.switchId,
    list: eventCommands,
  };

  const changeId = staging.addCreate("CommonEvent", fields);

  const entities = project.model.listEntities("CommonEvent");
  const maxPersistedId = entities.reduce((max, e) => Math.max(max, e.id), 0);
  const pendingCreates = staging
    .list()
    .filter((d) => d.type === "create" && d.entityType === "CommonEvent").length;
  const nextId = maxPersistedId + pendingCreates;

  return {
    changeId,
    preview: {
      entityType: "CommonEvent",
      fields: { ...fields, id: nextId },
    },
    validation: { ok: true },
  };
}
