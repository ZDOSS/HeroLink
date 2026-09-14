import { cpSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

export function isolatedFixture(name: string): string {
  const directory = mkdtempSync(join(tmpdir(), "herolink-fixture-"));
  cpSync(join(process.cwd(), "test/fixtures", name), directory, {
    recursive: true,
    filter: (source) => !source.split(/[\\/]/).includes(".bridge"),
  });
  afterAll(() => rmSync(directory, { recursive: true, force: true }));
  return realpathSync(directory);
}
