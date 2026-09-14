import { z } from "zod";
import type { Project } from "../io/project.js";
import { applyPatch } from "../mutate/apply.js";
import type { Staging } from "../mutate/staging.js";

export const ApplyPatchInput = z.object({
  confirm: z.literal(true),
  expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
});

export const ApplyPatchOutput = z.object({
  transactionId: z.string(),
  filesWritten: z.array(z.string()),
  backupDir: z.string(),
});

export async function applyPatchTool(
  project: Project,
  staging: Staging,
  rawInput: z.infer<typeof ApplyPatchInput>,
) {
  const input = ApplyPatchInput.parse(rawInput);
  return applyPatch(project, staging, input.expectedRevision);
}
