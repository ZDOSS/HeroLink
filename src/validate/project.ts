import type { RefIssue } from "../errors.js";
import type { NormalizedModel } from "../model/normalized.js";
import { validateReferences } from "./refs.js";

export interface ValidationResult {
  ok: boolean;
  issues: RefIssue[];
}

export function validateProject(model: NormalizedModel): ValidationResult {
  const issues = validateReferences(model);
  const ok = !issues.some((i) => i.severity === "error");
  return { ok, issues };
}
