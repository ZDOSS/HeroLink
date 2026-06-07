import { z } from "zod";
import type { Project } from "../io/project.js";
import type { Staging } from "../mutate/staging.js";
import { SkillSchema } from "../schema/entities.js";

export const CreateSkillDraftInput = z.object({
  fields: SkillSchema.partial().omit({ id: true }),
});

export const CreateSkillDraftOutput = z.object({
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

export function createSkillDraft(
  project: Project,
  staging: Staging,
  input: z.infer<typeof CreateSkillDraftInput>,
) {
  const changeId = staging.addCreate("Skill", input.fields);

  const entities = project.model.listEntities("Skill");
  const maxPersistedId = entities.reduce((max, e) => Math.max(max, e.id), 0);
  const pendingCreates = staging
    .list()
    .filter((d) => d.type === "create" && d.entityType === "Skill").length;
  const nextId = maxPersistedId + pendingCreates;

  return {
    changeId,
    preview: {
      entityType: "Skill",
      fields: { ...input.fields, id: nextId },
    },
    validation: { ok: true },
  };
}
