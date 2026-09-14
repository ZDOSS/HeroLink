import { z } from "zod";
import { ConflictError } from "../errors.js";
import type { Project } from "../io/project.js";
import type { Staging } from "../mutate/staging.js";
import { PluginName } from "../schema/safety.js";

export const AddPluginDraftInput = z.object({
  name: PluginName,
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
  rawInput: z.infer<typeof AddPluginDraftInput>,
) {
  const input = AddPluginDraftInput.parse(rawInput);
  const existing = project.model.plugins.find((p) => p.name === input.name);
  if (existing) {
    throw new ConflictError(`Plugin "${input.name}" already exists`);
  }

  const pendingAdds = staging.list().filter((d) => d.type === "addPlugin" && d.name === input.name);
  if (pendingAdds.length > 0) {
    throw new ConflictError(`Plugin "${input.name}" is already staged for addition`);
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
