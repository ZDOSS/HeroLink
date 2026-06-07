import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import fjp from "fast-json-patch";
import writeFileAtomic from "write-file-atomic";
import { StaleProjectError, ValidationError } from "../errors.js";
import { serializePluginsJs } from "../io/pluginsJs.js";
import type { Project } from "../io/project.js";
import { checkStaleness } from "../model/hash.js";
import type { EntityType } from "../model/normalized.js";
import { reloadModel } from "../model/normalized.js";
import { Backup } from "./backup.js";
import { buildWritePlans, computeNextIds } from "./patch.js";
import { getRelPath } from "./paths.js";
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

  const maxIds = new Map<EntityType, number>();
  for (const draft of drafts) {
    if (draft.type !== "create") continue;
    if (!maxIds.has(draft.entityType)) {
      const entities = project.model.listEntities(draft.entityType);
      const maxId = entities.reduce((max, e) => Math.max(max, e.id), 0);
      maxIds.set(draft.entityType, maxId);
    }
  }
  const nextIds = computeNextIds(drafts, maxIds);

  const mapEventIds = new Map<number, number[]>();
  for (const draft of drafts) {
    if (draft.type === "createMapEvent" || draft.type === "updateMapEvent") {
      if (!mapEventIds.has(draft.mapId)) {
        const events = project.model.getMapEvents(draft.mapId);
        mapEventIds.set(
          draft.mapId,
          events.map((e) => e.id),
        );
      }
    }
  }

  const currentPlugins = project.model.plugins.map((p) => ({
    name: p.name,
    status: p.status,
    description: p.description,
    parameters: { ...p.parameters },
  }));

  const writePlans = buildWritePlans(drafts, nextIds, currentPlugins, mapEventIds);

  const transactionId = `t-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const backup = new Backup(project.projectDir);

  const filesToWrite: string[] = [];
  for (const plan of writePlans) {
    if (plan.kind === "jsonPatch") {
      filesToWrite.push(join(project.projectDir, "data", plan.file));
    } else if (plan.kind === "pluginConfig") {
      filesToWrite.push(join(project.projectDir, "js", "plugins.js"));
    } else if (plan.kind === "pluginFile") {
      filesToWrite.push(join(project.projectDir, "js", "plugins", `${plan.name}.js`));
    }
  }

  const preHashes = backup.createBackup(transactionId, filesToWrite);
  const writtenFiles: string[] = [];

  try {
    for (const plan of writePlans) {
      if (plan.kind === "jsonPatch") {
        const filePath = join(project.projectDir, "data", plan.file);
        const content = readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);
        const clone = fjp.deepClone(data);
        fjp.applyPatch(clone, plan.ops, undefined, true, false);
        writeFileAtomic.sync(filePath, JSON.stringify(clone), "utf-8");
        writtenFiles.push(filePath);
      } else if (plan.kind === "pluginConfig") {
        const filePath = join(project.projectDir, "js", "plugins.js");
        const content = serializePluginsJs(
          plan.entries as Parameters<typeof serializePluginsJs>[0],
        );
        writeFileAtomic.sync(filePath, content, "utf-8");
        writtenFiles.push(filePath);
      } else if (plan.kind === "pluginFile") {
        const filePath = join(project.projectDir, "js", "plugins", `${plan.name}.js`);
        writeFileAtomic.sync(filePath, plan.source, "utf-8");
        writtenFiles.push(filePath);
      }
    }

    backup.recordTransaction(transactionId, filesToWrite, preHashes);
    staging.clear();
    reloadModel(project.model);

    return {
      transactionId,
      filesWritten: writtenFiles,
      backupDir: backup.getBackupDir(transactionId),
    };
  } catch (err) {
    for (const file of writtenFiles) {
      const relPath = getRelPath(file, project.projectDir);
      const backupPath = join(backup.getBackupDir(transactionId), relPath);
      try {
        if (existsSync(backupPath)) {
          const backupContent = readFileSync(backupPath, "utf-8");
          writeFileAtomic.sync(file, backupContent, "utf-8");
        }
      } catch {
        // Best effort rollback
      }
    }
    throw err;
  }
}
