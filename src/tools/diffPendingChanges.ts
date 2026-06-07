import { z } from "zod";
import type { Project } from "../io/project.js";
import type { EntityType } from "../model/normalized.js";
import { buildWritePlans, computeNextIds } from "../mutate/patch.js";
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

  const maxIds = new Map<EntityType, number>();
  for (const draft of drafts) {
    if (draft.type !== "create") continue;
    if (!maxIds.has(draft.entityType)) {
      const entities = project.model.listEntities(draft.entityType);
      const maxId = entities.reduce((max, e) => Math.max(max, e.id), 0);
      maxIds.set(draft.entityType, maxId);
    }
  }
  const nextIds = computeNextIds(drafts, maxIds);

  const currentPlugins = project.model.plugins.map((p) => ({
    name: p.name,
    status: p.status,
    description: p.description,
    parameters: { ...p.parameters },
  }));

  const mapEventIds = new Map<number, number[]>();
  for (const draft of drafts) {
    if (draft.type === "createMapEvent" || draft.type === "updateMapEvent") {
      if (!mapEventIds.has(draft.mapId)) {
        const events = project.model.getMapEvents(draft.mapId);
        mapEventIds.set(
          draft.mapId,
          events.map((e) => e.id),
        );
      }
    }
  }

  const writePlans = buildWritePlans(drafts, nextIds, currentPlugins, mapEventIds);

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

  const jsonPatches = writePlans
    .filter((p) => p.kind === "jsonPatch")
    .map((fp) => ({
      file: fp.file,
      ops: fp.ops as unknown as Record<string, unknown>[],
    }));

  return {
    patches: jsonPatches,
    humanSummary,
  };
}
