import { z } from "zod";
import { withProjectLock } from "../io/lock.js";
import type { Project } from "../io/project.js";
import { prepareCandidate } from "../mutate/candidate.js";
import type { Staging } from "../mutate/staging.js";
import { ValidateProjectRefsOutput } from "./validateProjectRefs.js";

export const DiffPendingChangesInput = z.object({});

export const DiffPendingChangesOutput = z.object({
  patches: z.array(
    z.object({
      kind: z.enum(["jsonPatch", "pluginConfig", "pluginFile"]),
      file: z.string().optional(),
      ops: z.array(z.record(z.unknown())).optional(),
      name: z.string().optional(),
      entries: z.array(z.record(z.unknown())).optional(),
      source: z.string().optional(),
    }),
  ),
  humanSummary: z.string(),
  revision: z.string(),
  validation: ValidateProjectRefsOutput,
  files: z.array(
    z.object({ file: z.string(), before: z.string().nullable(), after: z.string().nullable() }),
  ),
});

export function diffPendingChanges(project: Project, staging: Staging) {
  return withProjectLock(project.projectDir, () => {
    const candidate = prepareCandidate(project, staging);
    const drafts = candidate.state.drafts;
    const writePlans = candidate.plans;
    const creates = drafts.filter((d) => d.type === "create" || d.type === "createMapEvent").length;
    const updates = drafts.filter((d) => d.type === "update" || d.type === "updateMapEvent").length;
    const pluginChanges = drafts.filter(
      (d) => d.type === "setPluginParams" || d.type === "addPlugin",
    ).length;

    const parts: string[] = [];
    if (creates > 0) parts.push(`${creates} create(s)`);
    if (updates > 0) parts.push(`${updates} update(s)`);
    if (pluginChanges > 0) parts.push(`${pluginChanges} plugin change(s)`);
    const humanSummary = parts.join(", ") || "No pending changes";

    const patches = writePlans.map((plan) => {
      if (plan.kind === "jsonPatch") {
        return {
          kind: "jsonPatch" as const,
          file: plan.file,
          ops: plan.ops as unknown as Record<string, unknown>[],
        };
      }
      if (plan.kind === "pluginConfig") {
        return {
          kind: "pluginConfig" as const,
          file: "js/plugins.js",
          entries: plan.entries as unknown as Record<string, unknown>[],
        };
      }
      return {
        kind: "pluginFile" as const,
        name: plan.name,
        source: plan.source,
      };
    });

    return {
      patches,
      humanSummary,
      revision: candidate.revision,
      validation: candidate.validation,
      files: candidate.files,
    };
  });
}
