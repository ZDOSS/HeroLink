import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fjp from "fast-json-patch";
import writeFileAtomic from "write-file-atomic";
import { StaleProjectError, ValidationError } from "../errors.js";
import type { Project } from "../io/project.js";
import { checkStaleness } from "../model/hash.js";
import type { EntityType } from "../model/normalized.js";
import { Backup } from "./backup.js";
import { buildPatches } from "./patch.js";
import type { Staging } from "./staging.js";

export interface ApplyResult {
  transactionId: string;
  filesWritten: string[];
  backupDir: string;
}

export async function applyPatch(project: Project, staging: Staging): Promise<ApplyResult> {
  const drafts = staging.list();
  if (drafts.length === 0) {
    throw new ValidationError([
      { code: "custom", path: [], message: "No pending changes to apply" },
    ]);
  }

  const staleFiles = checkStaleness(project.model.fileSnapshots);
  if (staleFiles.length > 0) {
    throw new StaleProjectError(staleFiles);
  }

  const nextIds = computeNextIds(project, drafts);
  const filePatches = buildPatches(drafts, nextIds);

  const transactionId = `t-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const backup = new Backup(project.projectDir);

  const filesToWrite = filePatches.map((fp) => join(project.projectDir, "data", fp.file));
  const preHashes = backup.createBackup(transactionId, filesToWrite);

  const inversePatches: Record<string, import("fast-json-patch").Operation[]> = {};
  const writtenFiles: string[] = [];

  try {
    for (const fp of filePatches) {
      const filePath = join(project.projectDir, "data", fp.file);
      const content = readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);

      const clone = fjp.deepClone(data);
      fjp.applyPatch(clone, fp.ops, undefined, true, false);
      inversePatches[fp.file] = invertOps(fp.ops, data);

      writeFileAtomic.sync(filePath, JSON.stringify(clone), "utf-8");
      writtenFiles.push(filePath);
    }

    backup.recordTransaction(transactionId, filesToWrite, preHashes, inversePatches);
    staging.clear();

    return {
      transactionId,
      filesWritten: writtenFiles,
      backupDir: backup.getBackupDir(transactionId),
    };
  } catch (err) {
    for (const file of writtenFiles) {
      const relPath = file.replace(/\\/g, "/").split("/").slice(-2).join("/");
      const backupPath = join(backup.getBackupDir(transactionId), relPath);
      try {
        const backupContent = readFileSync(backupPath, "utf-8");
        writeFileAtomic.sync(file, backupContent, "utf-8");
      } catch {
        // Best effort rollback
      }
    }
    throw err;
  }
}

function computeNextIds(
  project: Project,
  drafts: import("./staging.js").Draft[],
): Map<EntityType, number> {
  const nextIds = new Map<EntityType, number>();

  for (const draft of drafts) {
    if (draft.type !== "create") continue;

    if (!nextIds.has(draft.entityType)) {
      const entities = project.model.listEntities(draft.entityType);
      const maxId = entities.reduce((max, e) => Math.max(max, e.id), 0);
      nextIds.set(draft.entityType, maxId + 1);
    } else {
      const currentId = nextIds.get(draft.entityType);
      if (currentId === undefined) {
        throw new Error(`No next ID found for entity type ${draft.entityType}`);
      }
      nextIds.set(draft.entityType, currentId + 1);
    }
  }

  return nextIds;
}

function invertOps(
  ops: import("fast-json-patch").Operation[],
  original: unknown,
): import("fast-json-patch").Operation[] {
  const inverted: import("fast-json-patch").Operation[] = [];

  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i];
    if (op.op === "add") {
      inverted.push({ op: "remove", path: op.path });
    } else if (op.op === "remove") {
      const pathParts = op.path.split("/").filter(Boolean);
      let value = original;
      for (const part of pathParts) {
        value = (value as Record<string, unknown>)[part];
      }
      inverted.push({ op: "add", path: op.path, value });
    } else if (op.op === "replace") {
      const pathParts = op.path.split("/").filter(Boolean);
      let value = original;
      for (const part of pathParts) {
        value = (value as Record<string, unknown>)[part];
      }
      inverted.push({ op: "replace", path: op.path, value });
    }
  }

  return inverted;
}
