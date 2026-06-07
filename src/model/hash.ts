import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { IoError } from "../errors.js";

export interface FileSnapshot {
  hash: string;
  mtime: number;
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

export function hashFile(filePath: string): string {
  try {
    const content = readFileSync(filePath, "utf-8");
    return hashContent(content);
  } catch (err) {
    throw new IoError(filePath, err);
  }
}

export function snapshotFile(filePath: string): FileSnapshot {
  try {
    const content = readFileSync(filePath, "utf-8");
    const stat = statSync(filePath);
    return {
      hash: hashContent(content),
      mtime: stat.mtimeMs,
    };
  } catch (err) {
    throw new IoError(filePath, err);
  }
}

export function snapshotFiles(files: string[]): Map<string, FileSnapshot> {
  const snapshots = new Map<string, FileSnapshot>();
  for (const file of files) {
    snapshots.set(file, snapshotFile(file));
  }
  return snapshots;
}

export function checkStaleness(snapshots: Map<string, FileSnapshot>): string[] {
  const changed: string[] = [];
  for (const [filePath, snapshot] of snapshots) {
    try {
      const current = snapshotFile(filePath);
      if (current.hash !== snapshot.hash) {
        changed.push(filePath);
      }
    } catch {
      changed.push(filePath);
    }
  }
  return changed;
}
