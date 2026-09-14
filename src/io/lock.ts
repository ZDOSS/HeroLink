import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import writeFileAtomic from "write-file-atomic";
import { z } from "zod";
import { ConflictError } from "../errors.js";
import { resolveProjectPathSafe } from "./paths.js";

const held = new Set<string>();
const Owner = z.object({ pid: z.number().int().positive(), token: z.string().uuid() });
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(error instanceof Error && "code" in error && error.code === "ESRCH");
  }
}

// Operations are synchronous: nested calls share ownership without yielding.
// A short acquisition gate serializes dead-owner recovery with new acquisitions.
// An abandoned gate is fail-closed and requires operator recovery.
export function withProjectLock<T>(projectDir: string, operation: () => T): T {
  const path = (name: string) => resolveProjectPathSafe(projectDir, `.bridge/${name}`);
  mkdirSync(path(""), { recursive: true });
  const lock = path("project.lock");
  if (held.has(lock)) return operation();
  const gate = path("project.gate");
  try {
    mkdirSync(gate);
  } catch {
    throw new ConflictError(
      "Project lock acquisition is busy; retry. An abandoned project.gate requires operator recovery.",
    );
  }
  const owner = { pid: process.pid, token: randomUUID() };
  try {
    if (existsSync(lock)) {
      let previous: z.infer<typeof Owner>;
      try {
        previous = Owner.parse(JSON.parse(readFileSync(path("project.lock/owner.json"), "utf8")));
      } catch {
        throw new ConflictError(
          "Project lock has no valid owner; preserve it for operator recovery.",
        );
      }
      if (alive(previous.pid))
        throw new ConflictError("Project is busy in another process; retry.");
      rmSync(lock, { recursive: true });
    }
    mkdirSync(lock);
    try {
      writeFileAtomic.sync(path("project.lock/owner.json"), JSON.stringify(owner));
    } catch (error) {
      rmSync(lock, { recursive: true });
      throw error;
    }
  } finally {
    rmSync(gate, { recursive: true });
  }
  held.add(lock);
  try {
    return operation();
  } finally {
    held.delete(lock);
    const current = Owner.parse(JSON.parse(readFileSync(path("project.lock/owner.json"), "utf8")));
    assertOwner(current.token, owner.token);
    rmSync(resolveProjectPathSafe(projectDir, lock), { recursive: true });
  }
}

function assertOwner(actual: string, expected: string): void {
  if (actual !== expected) throw new ConflictError("Project lock ownership changed");
}
