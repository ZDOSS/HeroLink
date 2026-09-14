import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, win32 } from "node:path";
import { PathEscapeError } from "../errors.js";

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

// Resolve existing ancestors too: new files must not escape through a symlink.
// Recheck this boundary immediately before every filesystem operation.
export function resolveProjectPathSafe(projectDir: string, path: string): string {
  const root = realpathSync(projectDir);
  // Project sessions receive a canonical root at load. If that root is later
  // replaced by a symlink, require reopening instead of following a new root.
  if (relative(root, resolve(projectDir)) !== "") throw new PathEscapeError(projectDir);
  if (
    normalizePath(path).split("/").includes("..") ||
    (win32.isAbsolute(path) && !isAbsolute(path))
  ) {
    throw new PathEscapeError(path);
  }
  const target = resolve(root, path);
  assertInside(root, target);
  let ancestor = target;
  while (!existsSync(ancestor)) {
    try {
      if (lstatSync(ancestor).isSymbolicLink()) throw new PathEscapeError(path);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    ancestor = dirname(ancestor);
  }
  const canonical = realpathSync(ancestor);
  assertInside(root, canonical);
  // Internal symlink aliases make logical database files ambiguous and can
  // redirect atomic replacement to a different entity file. Root aliases are
  // canonicalized above; internal aliases fail closed for reads and writes.
  if (relative(canonical, ancestor) !== "") throw new PathEscapeError(path);
  return target;
}

function assertInside(root: string, target: string): void {
  const rel = relative(root, target);
  if (
    rel === ".." ||
    rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(rel)
  ) {
    throw new PathEscapeError(target);
  }
}

export function resolveProjectPath(projectDir: string, path: string): string {
  return realpathSync(resolveProjectPathSafe(projectDir, path));
}
