import { z } from "zod";
import type { Project } from "../io/project.js";
import { Backup } from "../mutate/backup.js";

export const ListBackupsInput = z.object({});

export const ListBackupsOutput = z.object({
  transactions: z.array(
    z.object({
      id: z.string(),
      timestamp: z.string(),
      files: z.array(z.string()),
    }),
  ),
});

export function listBackups(project: Project) {
  const backup = new Backup(project.projectDir);
  const transactions = backup.listTransactions().map((t) => ({
    id: t.id,
    timestamp: t.timestamp,
    files: t.files,
  }));
  return { transactions };
}
