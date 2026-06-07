import { z } from "zod";
import type { Staging } from "../mutate/staging.js";

export const ListPendingChangesInput = z.object({});

export const ListPendingChangesOutput = z.object({
  changes: z.array(
    z.object({
      changeId: z.string(),
      type: z.string(),
      summary: z.string(),
    }),
  ),
});

export function listPendingChanges(_project: unknown, staging: Staging) {
  const drafts = staging.list();
  const changes = drafts.map((d) => {
    let summary: string;
    switch (d.type) {
      case "create":
        summary = `Create ${d.entityType}: ${(d.fields as Record<string, unknown>).name ?? "(unnamed)"}`;
        break;
      case "update":
        summary = `Update ${d.entityType}:${d.entityId}`;
        break;
      case "createMapEvent":
        summary = `Create map event on map ${d.mapId}: ${(d.event as Record<string, unknown>).name ?? "(unnamed)"}`;
        break;
      case "updateMapEvent":
        summary = `Update map event ${d.eventId} on map ${d.mapId}`;
        break;
      case "setPluginParams":
        summary = `Set params for plugin: ${d.pluginName}`;
        break;
      case "addPlugin":
        summary = `Add plugin: ${d.name}`;
        break;
      default: {
        const _exhaustive: never = d;
        summary = `Unknown: ${JSON.stringify(_exhaustive)}`;
      }
    }
    return { changeId: d.changeId, type: d.type, summary };
  });
  return { changes };
}
