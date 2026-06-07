import { z } from "zod";
import type { Project } from "../io/project.js";
import type { EntityType } from "../model/normalized.js";
import { buildPatches } from "../mutate/patch.js";
import type { Staging } from "../mutate/staging.js";

export const DiffPendingChangesInput = z.object({});

export const DiffPendingChangesOutput = z.object({
  patches: z.array(
    z.object({
      file: z.string(),
      ops: z.array(z.record(z.unknown())),
    }),
  ),
  humanSummary: z.string(),
});

export function diffPendingChanges(project: Project, staging: Staging) {
  const drafts = staging.list();
  if (drafts.length === 0) {
    return { patches: [], humanSummary: "No pending changes" };
  }

  const nextIds = computeNextIds(project, drafts);
  const filePatches = buildPatches(drafts, nextIds);

  const creates = drafts.filter((d) => d.type === "create").length;
  const updates = drafts.filter((d) => d.type === "update").length;
  const humanSummary = `${creates > 0 ? `${creates} create(s)` : ""}${creates > 0 && updates > 0 ? ", " : ""}${updates > 0 ? `${updates} update(s)` : ""}`;

  return {
    patches: filePatches.map((fp) => ({
      file: fp.file,
      ops: fp.ops as unknown as Record<string, unknown>[],
    })),
    humanSummary,
  };
}

function computeNextIds(
  project: Project,
  drafts: import("../mutate/staging.js").Draft[],
): Map<EntityType, number> {
  const nextIds = new Map<EntityType, number>();

  for (const draft of drafts) {
    if (draft.type !== "create") continue;

    if (!nextIds.has(draft.entityType)) {
      const entities = project.model.listEntities(draft.entityType);
      const maxId = entities.reduce((max, e) => Math.max(max, e.id), 0);
      nextIds.set(draft.entityType, maxId + 1);
    } else {
      const currentId = nextIds.get(draft.entityType);
      if (currentId === undefined) {
        throw new Error(`No next ID found for entity type ${draft.entityType}`);
      }
      nextIds.set(draft.entityType, currentId + 1);
    }
  }

  return nextIds;
}
