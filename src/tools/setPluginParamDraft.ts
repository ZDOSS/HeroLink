import { z } from "zod";
import type { Project } from "../io/project.js";
import type { Staging } from "../mutate/staging.js";

export const SetPluginParamDraftInput = z.object({
  pluginName: z.string().min(1),
  params: z.record(z.string()),
});

export const SetPluginParamDraftOutput = z.object({
  changeId: z.string(),
  preview: z.object({
    pluginName: z.string(),
    params: z.record(z.string()),
  }),
  validation: z.object({
    ok: z.boolean(),
    issues: z.array(z.string()).optional(),
  }),
});

export function setPluginParamDraft(
  project: Project,
  staging: Staging,
  input: z.infer<typeof SetPluginParamDraftInput>,
) {
  const plugin = project.model.plugins.find((p) => p.name === input.pluginName);
  if (!plugin) {
    throw new Error(`Plugin "${input.pluginName}" not found`);
  }

  const changeId = staging.addSetPluginParams(input.pluginName, input.params);

  return {
    changeId,
    preview: {
      pluginName: input.pluginName,
      params: input.params,
    },
    validation: { ok: true },
  };
}
