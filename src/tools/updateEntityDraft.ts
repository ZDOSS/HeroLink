import { z } from "zod";
import type { Project } from "../io/project.js";
import type { EntityType } from "../model/normalized.js";
import type { Staging } from "../mutate/staging.js";

export const UpdateEntityDraftInput = z.object({
  type: z.enum([
    "Actor",
    "Class",
    "Skill",
    "Item",
    "Weapon",
    "Armor",
    "Enemy",
    "Troop",
    "State",
    "CommonEvent",
  ]),
  id: z.number().int().positive(),
  patch: z.record(z.unknown()),
});

export const UpdateEntityDraftOutput = z.object({
  changeId: z.string(),
  preview: z.object({
    entityType: z.string(),
    entityId: z.number(),
    patch: z.record(z.unknown()),
  }),
  validation: z.object({
    ok: z.boolean(),
    issues: z.array(z.string()).optional(),
  }),
});

export function updateEntityDraft(
  project: Project,
  staging: Staging,
  input: z.infer<typeof UpdateEntityDraftInput>,
) {
  const entity = project.model.getEntity(input.type as EntityType, input.id);
  if (!entity) {
    throw new Error(`${input.type} with id ${input.id} not found`);
  }

  const changeId = staging.addUpdate(input.type as EntityType, input.id, input.patch);

  return {
    changeId,
    preview: {
      entityType: input.type,
      entityId: input.id,
      patch: input.patch,
    },
    validation: { ok: true },
  };
}
