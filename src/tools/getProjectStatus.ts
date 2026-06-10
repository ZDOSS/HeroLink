import { z } from "zod";
import type { Project } from "../io/project.js";

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
    dirty: false,
    pendingChanges: project.staging.list().length,
    lastTransactionId: null,
  };
}
