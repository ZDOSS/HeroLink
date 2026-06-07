import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import writeFileAtomic from "write-file-atomic";
import type { Project } from "../io/project.js";
import { reloadModel } from "../model/normalized.js";
import { Backup } from "./backup.js";
import { getRelPath } from "./paths.js";

export interface RollbackResult {
  restoredTransactionId: string;
  filesRestored: string[];
}

export function rollbackLastPatch(project: Project): RollbackResult {
  const backup = new Backup(project.projectDir);
  const lastTx = backup.getLastTransaction();

  if (!lastTx) {
    throw new Error("No transactions to rollback");
  }

  const filesRestored: string[] = [];

  for (const file of lastTx.files) {
    const preHash = lastTx.preHashes[file];

    if (preHash === "") {
      // New file that didn't exist before — delete it
      if (existsSync(file)) {
        unlinkSync(file);
      }
      filesRestored.push(file);
      continue;
    }

    const relPath = getRelPath(file, project.projectDir);
    const backupPath = join(backup.getBackupDir(lastTx.id), relPath);

    const backupContent = readFileSync(backupPath, "utf-8");
    writeFileAtomic.sync(file, backupContent, "utf-8");
    filesRestored.push(file);
  }

  backup.removeTransaction(lastTx.id);

  // Reload model to refresh both file snapshots and entity data after restore
  reloadModel(project.model);

  return {
    restoredTransactionId: lastTx.id,
    filesRestored,
  };
}
