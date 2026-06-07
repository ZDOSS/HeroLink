import { z } from "zod";
import type { Project } from "../io/project.js";
import type { Staging } from "../mutate/staging.js";

export const AddPluginDraftInput = z.object({
  name: z.string().min(1),
  source: z.string().min(1),
  status: z.boolean().default(true),
  params: z.record(z.string()).default({}),
});

export const AddPluginDraftOutput = z.object({
  changeId: z.string(),
  preview: z.object({
    name: z.string(),
    status: z.boolean(),
    params: z.record(z.string()),
  }),
  validation: z.object({
    ok: z.boolean(),
    issues: z.array(z.string()).optional(),
  }),
});

export function addPluginDraft(
  project: Project,
  staging: Staging,
  input: z.infer<typeof AddPluginDraftInput>,
) {
  const existing = project.model.plugins.find((p) => p.name === input.name);
  if (existing) {
    throw new Error(`Plugin "${input.name}" already exists`);
  }

  const pendingAdds = staging.list().filter((d) => d.type === "addPlugin" && d.name === input.name);
  if (pendingAdds.length > 0) {
    throw new Error(`Plugin "${input.name}" is already staged for addition`);
  }

  const changeId = staging.addAddPlugin(input.name, input.source, input.status, input.params);

  return {
    changeId,
    preview: {
      name: input.name,
      status: input.status,
      params: input.params,
    },
    validation: { ok: true },
  };
}
