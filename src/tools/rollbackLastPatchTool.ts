import { z } from "zod";
import type { Project } from "../io/project.js";
import { rollbackLastPatch } from "../mutate/rollback.js";

export const RollbackLastPatchInput = z.object({});

export const RollbackLastPatchOutput = z.object({
  restoredTransactionId: z.string(),
  filesRestored: z.array(z.string()),
});

export function rollbackLastPatchTool(project: Project) {
  return rollbackLastPatch(project);
}
