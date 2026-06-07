import { z } from "zod";
import type { Project } from "../io/project.js";
import type { EntityType } from "../model/normalized.js";
import { buildWritePlans, computeNextIds } from "../mutate/patch.js";
import type { Staging } from "../mutate/staging.js";

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
  };
}
