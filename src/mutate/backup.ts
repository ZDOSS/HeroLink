import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { z } from "zod";
import { IoError } from "../errors.js";
import { withProjectLock } from "../io/lock.js";
import { resolveProjectPathSafe } from "../io/paths.js";
import { hashContent } from "../model/hash.js";
import { getRelPath } from "./paths.js";

export const TransactionId = z.string().regex(/^t-[0-9]+-[a-f0-9-]+$/);
const hashes = z.record(z.string().regex(/^(?:[a-f0-9]{64})?$/));
export const TransactionSchema = z
  .object({
    id: TransactionId,
    timestamp: z.string().datetime(),
    files: z.array(z.string()).min(1),
    preHashes: hashes,
    postHashes: hashes.optional(),
  })
  .strict();
export type TransactionRecord = z.infer<typeof TransactionSchema>;

export class Backup {
  constructor(readonly projectDir: string) {
    this.projectDir = realpathSync(projectDir);
  }
  private path(file: string): string {
    return resolveProjectPathSafe(this.projectDir, file);
  }
  createBackup(
    transactionId: string,
    files: string[],
    captured?: Map<string, string | null>,
  ): Record<string, string> {
    return withProjectLock(this.projectDir, () => {
      const preHashes: Record<string, string> = {};
      for (const file of files) {
        const safe = this.path(file);
        const content = captured?.has(file)
          ? captured.get(file)
          : existsSync(safe)
            ? readFileSync(safe, "utf8")
            : null;
        preHashes[file] = content == null ? "" : hashContent(content);
        if (content == null) continue;
        const backup = this.path(
          `${getRelPath(this.getBackupDir(transactionId), this.projectDir)}/${getRelPath(safe, this.projectDir)}`,
        );
        mkdirSync(dirname(backup), { recursive: true });
        writeFileAtomic.sync(this.path(backup), content, "utf8");
      }
      return preHashes;
    });
  }
  recordTransaction(
    transactionId: string,
    files: string[],
    preHashes: Record<string, string>,
    postHashes?: Record<string, string>,
  ): void {
    withProjectLock(this.projectDir, () =>
      this.replaceTransactions([
        ...this.listTransactions(),
        { id: transactionId, timestamp: new Date().toISOString(), files, preHashes, postHashes },
      ]),
    );
  }
  validate(record: TransactionRecord): void {
    TransactionSchema.parse(record);
    for (const file of record.files) {
      const rel = getRelPath(this.path(file), this.projectDir);
      if (!/^(?:data\/[^/]+\.json|js\/plugins\/[^/]+\.js|js\/plugins\.js)$/.test(rel))
        throw new IoError(file, "Invalid transaction destination");
      if (!(file in record.preHashes) || (record.postHashes && !(file in record.postHashes)))
        throw new IoError(file, "Missing transaction hash");
    }
    if (new Set(record.files).size !== record.files.length)
      throw new IoError(record.id, "Duplicate transaction destinations");
  }
  listTransactions(): TransactionRecord[] {
    return withProjectLock(this.projectDir, () => {
      const path = this.path(".bridge/journal.jsonl");
      if (!existsSync(path)) return [];
      try {
        return readFileSync(path, "utf8")
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => {
            const record = TransactionSchema.parse(JSON.parse(line));
            this.validate(record);
            return record;
          });
      } catch (error) {
        throw new IoError(path, error);
      }
    });
  }
  replaceTransactions(records: TransactionRecord[]): void {
    withProjectLock(this.projectDir, () => {
      for (const record of records) this.validate(record);
      writeFileAtomic.sync(
        this.path(".bridge/journal.jsonl"),
        records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : ""),
        "utf8",
      );
    });
  }
  getLastTransaction(): TransactionRecord | undefined {
    return this.listTransactions().at(-1);
  }
  removeTransaction(id: string): void {
    withProjectLock(this.projectDir, () =>
      this.replaceTransactions(this.listTransactions().filter((t) => t.id !== id)),
    );
  }
  getBackupDir(id: string): string {
    TransactionId.parse(id);
    return this.path(`.bridge/backups/${id}`);
  }
  backupExists(id: string): boolean {
    return existsSync(this.getBackupDir(id));
  }
}
