import { z } from "zod";
import type { Project } from "../io/project.js";
import { checkStaleness } from "../model/hash.js";
import { Backup } from "../mutate/backup.js";

export const GetProjectStatusInput = z.object({});

export const GetProjectStatusOutput = z.object({
  projectDir: z.string(),
  engine: z.string(),
  gameTitle: z.string(),
  versionId: z.number(),
  dirty: z.boolean(),
  pendingChanges: z.number(),
  lastTransactionId: z.string().nullable(),
});

export function getProjectStatus(project: Project) {
  return {
    projectDir: project.projectDir,
    engine: project.adapter.id,
    gameTitle: project.model.system.gameTitle,
    versionId: project.model.system.versionId,
    dirty: checkStaleness(project.model.fileSnapshots).length > 0,
    pendingChanges: project.staging.list().length,
    lastTransactionId: new Backup(project.projectDir).getLastTransaction()?.id ?? null,
  };
}
