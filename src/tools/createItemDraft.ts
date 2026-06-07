import { z } from "zod";
import type { Project } from "../io/project.js";
import type { Staging } from "../mutate/staging.js";
import { ItemSchema } from "../schema/entities.js";

export const CreateItemDraftInput = z.object({
  fields: ItemSchema.partial().omit({ id: true }),
});

export const CreateItemDraftOutput = z.object({
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

export function createItemDraft(
  project: Project,
  staging: Staging,
  input: z.infer<typeof CreateItemDraftInput>,
) {
  const changeId = staging.addCreate("Item", input.fields);

  const entities = project.model.listEntities("Item");
  const nextId = entities.reduce((max, e) => Math.max(max, e.id), 0) + 1;

  return {
    changeId,
    preview: {
      entityType: "Item",
      fields: { ...input.fields, id: nextId },
    },
    validation: { ok: true },
  };
}
