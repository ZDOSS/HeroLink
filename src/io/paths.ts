import { realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { PathEscapeError } from "../errors.js";

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

export function resolveProjectPath(projectDir: string, relativePath: string): string {
  const root = realpathSync(resolve(projectDir));
  const target = isAbsolute(relativePath) ? relativePath : join(projectDir, relativePath);
  const resolved = realpathSync(resolve(target));

  const rel = relative(root, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new PathEscapeError(normalizePath(resolved));
  }

  return resolved;
}

export function resolveProjectPathSafe(projectDir: string, relativePath: string): string {
  const root = resolve(projectDir);
  const target = isAbsolute(relativePath) ? relativePath : join(projectDir, relativePath);
  const resolved = resolve(target);

  const rel = relative(root, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new PathEscapeError(normalizePath(resolved));
  }

  return resolved;
}
