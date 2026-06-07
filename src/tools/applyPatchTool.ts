import { z } from "zod";
import type { Project } from "../io/project.js";
import { applyPatch } from "../mutate/apply.js";
import type { Staging } from "../mutate/staging.js";

export const ApplyPatchInput = z.object({
  confirm: z.literal(true),
});

export const ApplyPatchOutput = z.object({
  transactionId: z.string(),
  filesWritten: z.array(z.string()),
  backupDir: z.string(),
});

export async function applyPatchTool(
  project: Project,
  staging: Staging,
  input: z.infer<typeof ApplyPatchInput>,
) {
  if (!input.confirm) {
    throw new Error("Must pass confirm: true to apply changes");
  }
  return applyPatch(project, staging);
}
