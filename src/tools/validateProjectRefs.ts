import { z } from "zod";
import type { Project } from "../io/project.js";
import { validateProject } from "../validate/project.js";

export const ValidateProjectRefsInput = z.object({});

export const ValidateProjectRefsOutput = z.object({
  ok: z.boolean(),
  issues: z.array(
    z.object({
      severity: z.enum(["error", "warn"]),
      location: z.string(),
      message: z.string(),
      refKind: z.string(),
    }),
  ),
});

export function validateProjectRefs(project: Project) {
  return validateProject(project.model);
}
