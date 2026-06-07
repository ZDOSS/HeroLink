import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export type FixtureName = "sample-project" | "broken-project";

export async function withTempProject(
  fixture: FixtureName,
  fn: (projectDir: string) => Promise<void>,
): Promise<void> {
  const fixtureDir = join(process.cwd(), "test", "fixtures", fixture);
  const tempDir = mkdtempSync(join(tmpdir(), "rpgmv-test-"));
  const projectDir = join(tempDir, fixture);

  cpSync(fixtureDir, projectDir, { recursive: true });

  try {
    await fn(projectDir);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
