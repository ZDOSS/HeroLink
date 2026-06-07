import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type fjp from "fast-json-patch";
import { hashContent } from "../model/hash.js";

export interface TransactionRecord {
  id: string;
  timestamp: string;
  files: string[];
  preHashes: Record<string, string>;
  inversePatches: Record<string, fjp.Operation[]>;
}

export class Backup {
  private readonly bridgeDir: string;
  private readonly journalPath: string;

  constructor(projectDir: string) {
    this.bridgeDir = join(projectDir, ".bridge");
    this.journalPath = join(this.bridgeDir, "journal.jsonl");
  }

  createBackup(transactionId: string, files: string[]): Record<string, string> {
    const backupDir = join(this.bridgeDir, "backups", transactionId);
    mkdirSync(backupDir, { recursive: true });

    const preHashes: Record<string, string> = {};
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      preHashes[file] = hashContent(content);

      const relPath = file.replace(/\\/g, "/").split("/").slice(-2).join("/");
      const backupPath = join(backupDir, relPath);
      mkdirSync(join(backupPath, ".."), { recursive: true });
      copyFileSync(file, backupPath);
    }

    return preHashes;
  }

  recordTransaction(
    transactionId: string,
    files: string[],
    preHashes: Record<string, string>,
    inversePatches: Record<string, fjp.Operation[]>,
  ): void {
    const record: TransactionRecord = {
      id: transactionId,
      timestamp: new Date().toISOString(),
      files,
      preHashes,
      inversePatches,
    };
    writeFileSync(this.journalPath, `${JSON.stringify(record)}\n`, { flag: "a" });
  }

  listTransactions(): TransactionRecord[] {
    if (!existsSync(this.journalPath)) {
      return [];
    }
    const content = readFileSync(this.journalPath, "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as TransactionRecord);
  }

  getLastTransaction(): TransactionRecord | undefined {
    const transactions = this.listTransactions();
    return transactions[transactions.length - 1];
  }

  getBackupDir(transactionId: string): string {
    return join(this.bridgeDir, "backups", transactionId);
  }

  backupExists(transactionId: string): boolean {
    return existsSync(this.getBackupDir(transactionId));
  }
}
