import { z } from "zod";
import type { Staging } from "../mutate/staging.js";

export const ListPendingChangesInput = z.object({});

export const ListPendingChangesOutput = z.object({
  changes: z.array(
    z.object({
      changeId: z.string(),
      type: z.enum(["create", "update"]),
      summary: z.string(),
    }),
  ),
});

export function listPendingChanges(_project: unknown, staging: Staging) {
  const drafts = staging.list();
  const changes = drafts.map((d) => ({
    changeId: d.changeId,
    type: d.type,
    summary:
      d.type === "create"
        ? `Create ${d.entityType}: ${(d.fields as Record<string, unknown>).name ?? "(unnamed)"}`
        : `Update ${d.entityType}:${d.entityId}`,
  }));
  return { changes };
}
