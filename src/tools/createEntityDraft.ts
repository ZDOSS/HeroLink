import { z } from "zod";
import type { Project } from "../io/project.js";
import type { EntityType } from "../model/normalized.js";
import type { Staging } from "../mutate/staging.js";
import { ConstrainedCommandSchema, compileCommandList } from "../schema/commands.js";
import { TroopPageSchema, TroopSchema } from "../schema/entities.js";
import { validateEntityFields } from "../schema/safety.js";

export const CreateEntityDraftInput = z.object({
  type: z.enum(["Actor", "Class", "Weapon", "Armor", "State", "Enemy", "Troop", "CommonEvent"]),
  fields: z.record(z.unknown()),
});

export const CreateEntityDraftOutput = z.object({
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

export function createEntityDraft(
  project: Project,
  staging: Staging,
  rawInput: z.infer<typeof CreateEntityDraftInput>,
) {
  const input = CreateEntityDraftInput.parse(rawInput);
  if (input.type === "Troop") {
    const page = TroopPageSchema.omit({ list: true })
      .extend({ commands: z.array(ConstrainedCommandSchema) })
      .strict();
    const troop = TroopSchema.omit({ id: true, pages: true })
      .extend({ pages: z.array(page) })
      .strict()
      .parse(input.fields);
    input.fields = {
      ...troop,
      pages: troop.pages.map(({ commands, ...fields }) => ({
        ...fields,
        list: compileCommandList(commands),
      })),
    };
    validateEntityFields(input.type, input.fields, false);
  } else validateEntityFields(input.type, input.fields, false, true);
  const changeId = staging.addCreate(input.type as EntityType, input.fields);

  const entities = project.model.listEntities(input.type as EntityType);
  const maxPersistedId = entities.reduce((max, e) => Math.max(max, e.id), 0);
  const pendingCreates = staging
    .list()
    .filter((d) => d.type === "create" && d.entityType === input.type).length;
  const nextId = maxPersistedId + pendingCreates;

  return {
    changeId,
    preview: {
      entityType: input.type,
      fields: { ...input.fields, id: nextId },
    },
    validation: { ok: true },
  };
}
