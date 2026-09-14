import { z } from "zod";
import { ValidationError } from "../errors.js";
import { withProjectLock } from "../io/lock.js";
import type { Project } from "../io/project.js";
import { prepareCandidate } from "../mutate/candidate.js";
import { validateProject } from "../validate/project.js";

export const ValidateProjectRefsInput = z.object({ includePending: z.boolean().default(false) });

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

export function validateProjectRefs(project: Project, input: { includePending?: boolean } = {}) {
  return withProjectLock(project.projectDir, () => {
    try {
      return input.includePending
        ? prepareCandidate(project, project.staging).validation
        : validateProject(project.model);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof z.ZodError)
        return {
          ok: false,
          issues: error.issues.map((i) => ({
            severity: "error" as const,
            location: i.path.join("."),
            message: i.message,
            refKind: "schema",
          })),
        };
      throw error;
    }
  });
}
