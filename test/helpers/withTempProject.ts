import writeFileAtomic from "write-file-atomic";
import { readFileSync, realpathSync } from "node:fs";
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
  let projectDir = join(tempDir, fixture);

  cpSync(fixtureDir, projectDir, {
    recursive: true,
    filter: (source) => !source.split(/[\\/]/).includes(".bridge"),
  });

  projectDir = realpathSync(projectDir);

  // The original generated fixture intentionally omits its referenced tileset.
  // Mutation tests use a complete assembly, while validation tests retain the
  // original fixture and assert that its missing reference is reported.
  if (fixture === "sample-project") {
    const tilesetFile = join(projectDir, "data", "Tilesets.json");
    const tilesets = JSON.parse(readFileSync(tilesetFile, "utf8"));
    const infos = JSON.parse(readFileSync(join(projectDir, "data", "MapInfos.json"), "utf8"));
    for (const info of infos.filter(Boolean)) {
      const map = JSON.parse(
        readFileSync(
          join(projectDir, "data", `Map${String(info.id).padStart(3, "0")}.json`),
          "utf8",
        ),
      );
      // Test-only empty tileset: no assets or game-design content are invented.
      if (!tilesets[map.tilesetId])
        tilesets[map.tilesetId] = {
          id: map.tilesetId,
          name: "Empty test tileset",
          mode: 1,
          flags: Array(8192).fill(0),
          tilesetNames: Array(9).fill(""),
          note: "",
        };
    }
    writeFileAtomic.sync(tilesetFile, JSON.stringify(tilesets));
  }
  try {
    await fn(projectDir);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
