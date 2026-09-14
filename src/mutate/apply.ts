import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { z } from "zod";
import { ConflictError, IoError, RefIntegrityError, StaleProjectError } from "../errors.js";
import { withProjectLock } from "../io/lock.js";
import { resolveProjectPathSafe } from "../io/paths.js";
import { type Project, detectAdapter } from "../io/project.js";
import { checkStaleness } from "../model/hash.js";
import { loadModelFromText, reloadModel } from "../model/normalized.js";
import { invalid } from "../schema/safety.js";
import { validateProject } from "../validate/project.js";
import { Backup, TransactionId, type TransactionRecord, TransactionSchema } from "./backup.js";
import {
  type CandidateFile,
  assertBaseline,
  contentHash,
  prepareCandidate,
  readText,
  replayCandidate,
} from "./candidate.js";
import { getRelPath } from "./paths.js";
import { type Staging, type StagingData, parseStagingData } from "./staging.js";

const Manifest = z
  .object({
    version: z.literal(1),
    id: TransactionId,
    phase: z.enum(["prepared", "committed"]),
    files: z
      .array(
        z
          .object({ file: z.string(), before: z.string().nullable(), after: z.string().nullable() })
          .strict(),
      )
      .min(1),
  })
  .strict();
type ManifestData = z.infer<typeof Manifest>;
const manifestPath = (root: string) => resolveProjectPathSafe(root, ".bridge/transaction.json");
const transactionId = () => `t-${Date.now()}-${randomUUID().slice(0, 8)}`;

function target(root: string, file: string): string {
  if (
    !/^(?:data\/[^/]+\.json|js\/plugins\/[^/]+\.js|js\/plugins\.js|\.bridge\/(?:staging\.json|journal\.jsonl))$/.test(
      file,
    )
  )
    invalid(`Invalid transaction target: ${file}`);
  return resolveProjectPathSafe(root, file);
}
function writeTarget(root: string, file: string, content: string | null): void {
  const path = target(root, file);
  if (content === null) {
    if (existsSync(path)) unlinkSync(path);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileAtomic.sync(target(root, file), content, "utf8");
  }
}
function validateManifest(root: string, manifest: ManifestData): void {
  const paths = new Set<string>();
  for (const entry of manifest.files) {
    const path = target(root, entry.file);
    if (paths.has(path)) invalid("Duplicate recovery target");
    paths.add(path);
    const current = contentHash(readText(root, entry.file));
    if (current !== contentHash(entry.before) && current !== contentHash(entry.after))
      throw new StaleProjectError([entry.file]);
  }
  validateRecoveryProof(root, manifest);
}

function validateRecoveryProof(root: string, manifest: ManifestData): void {
  const backup = new Backup(root);
  const entries = new Map(manifest.files.map((f) => [f.file, f]));
  const journal = entries.get(".bridge/journal.jsonl");
  if (!journal || journal.after === null) invalid("Recovery requires complete journal metadata");
  const records = (text: string | null) =>
    (text ?? "")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const record = TransactionSchema.parse(JSON.parse(line));
        backup.validate(record);
        return record;
      });
  const prior = records(journal.before);
  const next = records(journal.after);
  const stage = entries.get(".bridge/staging.json");
  const files = manifest.files.filter((f) => !f.file.startsWith(".bridge/"));
  const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const before = (file: string) => {
    const entry = entries.get(file);
    return entry ? entry.before : readText(root, file);
  };
  const required =
    (read: (file: string) => string | null) =>
    (file: string): string => {
      const bytes = read(file);
      if (bytes === null) invalid(`Missing required recovery file ${file}`);
      return bytes;
    };
  // The manifest itself is not authority to write arbitrary bytes. Require its
  // journal transition, exact backups and the same candidate replay as apply.
  if (stage) {
    const record = next.at(-1);
    if (!record || record.id !== manifest.id || !equal(next.slice(0, -1), prior))
      invalid("Invalid apply journal transition");
    const state = parseStagingData(JSON.parse(required(before)(".bridge/staging.json")));
    const cleared = parseStagingData(JSON.parse(stage.after ?? "null"));
    if (!state.drafts.length || cleared.drafts.length || Object.keys(cleared.baseHashes).length)
      invalid("Invalid apply staging transition");
    const baseline = (file: string) => {
      const bytes = before(file);
      if (state.baseHashes[file] !== contentHash(bytes))
        invalid(`Missing or changed recovery baseline: ${file}`);
      return bytes;
    };
    for (const file of Object.keys(state.baseHashes)) {
      target(root, file);
      baseline(file);
    }
    const model = loadModelFromText(root, detectAdapter(root), required(baseline));
    const candidate = replayCandidate(model, state, baseline);
    if (!candidate.validation.ok) throw new RefIntegrityError(candidate.validation.issues);
    if (
      files.length !== candidate.files.length ||
      candidate.files.some((f) => !equal(entries.get(f.file), f))
    )
      invalid("Recovery bytes differ from the validated drafts");
    if (
      !equal(
        record.files,
        files.map((f) => target(root, f.file)),
      )
    )
      invalid("Recovery journal file set differs");
    for (const file of files) {
      const absolute = target(root, file.file);
      if (
        record.preHashes[absolute] !== contentHash(file.before) ||
        record.postHashes?.[absolute] !== contentHash(file.after)
      )
        invalid("Recovery journal hashes differ");
    }
  } else {
    const record = prior.at(-1);
    if (!record?.postHashes || !equal(prior.slice(0, -1), next))
      invalid("Invalid rollback journal transition");
    if (
      !equal(
        record.files,
        files.map((f) => target(root, f.file)),
      )
    )
      invalid("Rollback recovery file set differs");
    for (const file of files) {
      const absolute = target(root, file.file);
      const originalBackup = readText(
        root,
        `${getRelPath(backup.getBackupDir(record.id), root)}/${file.file}`,
      );
      if (
        record.postHashes[absolute] !== contentHash(file.before) ||
        record.preHashes[absolute] !== contentHash(file.after) ||
        originalBackup !== file.after
      )
        invalid("Rollback recovery hashes or backup differ");
    }
    const desired = (file: string) => {
      const entry = entries.get(file);
      return entry ? entry.after : readText(root, file);
    };
    const validation = validateProject(
      loadModelFromText(root, detectAdapter(root), required(desired)),
    );
    if (!validation.ok) throw new RefIntegrityError(validation.issues);
  }
  for (const file of files) {
    const captured = readText(
      root,
      `${getRelPath(backup.getBackupDir(manifest.id), root)}/${file.file}`,
    );
    if (captured !== file.before) invalid(`Missing or corrupt recovery backup: ${file.file}`);
  }
}

// A prepared operation is undone after interruption; a committed one is completed.
// The durable manifest precedes every target write, including staging and journal.
// Recovery is idempotent and validates ALL observed files before restoring any.
// Only this module writes/removes files in the game's data/ and js/ directories.
export function recoverInterruptedTransaction(root: string): void {
  withProjectLock(root, () => {
    if (!existsSync(manifestPath(root))) return;
    let manifest: ManifestData;
    try {
      manifest = Manifest.parse(JSON.parse(readFileSync(manifestPath(root), "utf8")));
    } catch (error) {
      throw new IoError(manifestPath(root), error);
    }
    validateManifest(root, manifest);
    for (const entry of [...manifest.files].reverse()) {
      const desired = entry[manifest.phase === "committed" ? "after" : "before"];
      if (readText(root, entry.file) !== desired) writeTarget(root, entry.file, desired);
    }
    unlinkSync(manifestPath(root));
  });
}

function transact(
  project: Project,
  files: CandidateFile[],
  metadata: CandidateFile[],
  commitMetadata: () => void,
  id: string,
): void {
  const root = project.projectDir;
  const manifest: ManifestData = {
    version: 1,
    id,
    phase: "prepared",
    files: [...files, ...metadata],
  };
  validateManifest(root, manifest);
  writeFileAtomic.sync(manifestPath(root), JSON.stringify(manifest), "utf8");
  try {
    for (const entry of files) {
      if (readText(root, entry.file) !== entry.before) throw new StaleProjectError([entry.file]);
      writeTarget(root, entry.file, entry.after);
    }
    commitMetadata();
    reloadModel(project.model);
    manifest.phase = "committed";
    writeFileAtomic.sync(manifestPath(root), JSON.stringify(manifest), "utf8");
  } catch (error) {
    // Even a write throwing after rename is covered by the predeclared manifest.
    try {
      manifest.phase = "prepared";
      writeFileAtomic.sync(manifestPath(root), JSON.stringify(manifest), "utf8");
      recoverInterruptedTransaction(root);
      reloadModel(project.model);
    } catch (recovery) {
      throw new AggregateError(
        [error, recovery],
        "Transaction failed; recovery is pending. Preserve .bridge/transaction.json and retry after resolving the conflict.",
      );
    }
    throw error;
  }
  // Cleanup failure after the commit decision is safe to finish on next access.
  try {
    unlinkSync(manifestPath(root));
  } catch {
    /* committed manifest remains recoverable */
  }
}

export interface ApplyResult {
  transactionId: string;
  filesWritten: string[];
  backupDir: string;
}
export async function applyPatch(
  project: Project,
  staging: Staging,
  expectedRevision?: string,
): Promise<ApplyResult> {
  return withProjectLock(project.projectDir, () => {
    recoverInterruptedTransaction(project.projectDir);
    const candidate = prepareCandidate(project, staging);
    if (!candidate.state.drafts.length) invalid("No pending changes to apply");
    if (expectedRevision !== undefined && candidate.revision !== expectedRevision)
      throw new ConflictError("Pending changes differ from the reviewed revision. Preview again.");
    if (!candidate.validation.ok) throw new RefIntegrityError(candidate.validation.issues);
    const stale = checkStaleness(project.model.fileSnapshots);
    if (stale.length) throw new StaleProjectError(stale);
    assertBaseline(project, candidate.state);
    const id = transactionId();
    const backup = new Backup(project.projectDir);
    const absoluteFiles = candidate.files.map((f) => target(project.projectDir, f.file));
    const captured = new Map(
      candidate.files.map((f) => [target(project.projectDir, f.file), f.before]),
    );
    const preHashes = backup.createBackup(id, absoluteFiles, captured);
    const postHashes = Object.fromEntries(
      candidate.files.map((f) => [target(project.projectDir, f.file), contentHash(f.after)]),
    );
    const records = backup.listTransactions();
    const record: TransactionRecord = {
      id,
      timestamp: new Date().toISOString(),
      files: absoluteFiles,
      preHashes,
      postHashes,
    };
    const nextStage: StagingData = {
      version: 1,
      revision: randomUUID(),
      drafts: [],
      baseHashes: {},
    };
    const metadata = [
      {
        file: ".bridge/journal.jsonl",
        before: readText(project.projectDir, ".bridge/journal.jsonl"),
        after: `${[...records, record].map((r) => JSON.stringify(r)).join("\n")}\n`,
      },
      {
        file: ".bridge/staging.json",
        before: readText(project.projectDir, ".bridge/staging.json"),
        after: JSON.stringify(nextStage, null, 2),
      },
    ];
    transact(
      project,
      candidate.files,
      metadata,
      () => {
        backup.replaceTransactions([...records, record]);
        staging.clear(nextStage);
      },
      id,
    );
    return { transactionId: id, filesWritten: absoluteFiles, backupDir: backup.getBackupDir(id) };
  });
}

export function rollbackTransaction(project: Project): {
  restoredTransactionId: string;
  filesRestored: string[];
} {
  return withProjectLock(project.projectDir, () => {
    recoverInterruptedTransaction(project.projectDir);
    const backup = new Backup(project.projectDir);
    const records = backup.listTransactions();
    const record = records.at(-1);
    if (!record) throw new ConflictError("No transactions to rollback");
    if (!record.postHashes)
      throw new ConflictError(
        "Legacy transaction has no post-hashes; automatic rollback cannot safely verify later edits. Backups are preserved.",
      );
    const files: CandidateFile[] = record.files.map((file) => {
      const rel = getRelPath(file, project.projectDir);
      const before = readText(project.projectDir, rel);
      if (contentHash(before) !== record.postHashes?.[file]) throw new StaleProjectError([file]);
      const after =
        record.preHashes[file] === ""
          ? null
          : readText(
              project.projectDir,
              `${getRelPath(backup.getBackupDir(record.id), project.projectDir)}/${rel}`,
            );
      if (contentHash(after) !== record.preHashes[file])
        throw new IoError(file, "Missing or corrupt backup");
      return { file: rel, before, after };
    });
    const remaining = records.slice(0, -1);
    const metadata = [
      {
        file: ".bridge/journal.jsonl",
        before: readText(project.projectDir, ".bridge/journal.jsonl"),
        after: remaining.map((r) => JSON.stringify(r)).join("\n") + (remaining.length ? "\n" : ""),
      },
    ];
    const id = transactionId();
    backup.createBackup(
      id,
      record.files,
      new Map(files.map((f) => [target(project.projectDir, f.file), f.before])),
    );
    transact(project, files, metadata, () => backup.replaceTransactions(remaining), id);
    return { restoredTransactionId: record.id, filesRestored: record.files };
  });
}
