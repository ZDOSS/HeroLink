import { relative } from "node:path";
import { normalizePath, resolveProjectPathSafe } from "../io/paths.js";

export function getRelPath(file: string, projectDir: string): string {
  return normalizePath(relative(projectDir, resolveProjectPathSafe(projectDir, file)));
}
