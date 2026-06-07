import { readFileSync } from "node:fs";
import { join } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { Backup } from "./backup.js";

export interface RollbackResult {
  restoredTransactionId: string;
  filesRestored: string[];
}

export function rollbackLastPatch(projectDir: string): RollbackResult {
  const backup = new Backup(projectDir);
  const lastTx = backup.getLastTransaction();

  if (!lastTx) {
    throw new Error("No transactions to rollback");
  }

  const filesRestored: string[] = [];

  for (const file of lastTx.files) {
    const relPath = file.replace(/\\/g, "/").split("/").slice(-2).join("/");
    const backupPath = join(backup.getBackupDir(lastTx.id), relPath);

    const backupContent = readFileSync(backupPath, "utf-8");
    writeFileAtomic.sync(file, backupContent, "utf-8");
    filesRestored.push(file);
  }

  backup.removeTransaction(lastTx.id);

  return {
    restoredTransactionId: lastTx.id,
    filesRestored,
  };
}
