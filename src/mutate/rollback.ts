import type { Project } from "../io/project.js";
import { rollbackTransaction } from "./apply.js";
export interface RollbackResult {
  restoredTransactionId: string;
  filesRestored: string[];
}
export function rollbackLastPatch(project: Project): RollbackResult {
  return rollbackTransaction(project);
}
