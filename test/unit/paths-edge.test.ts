import { describe, it, expect } from "vitest";
import { resolveProjectPathSafe, normalizePath } from "../../src/io/paths.js";
import { PathEscapeError } from "../../src/errors.js";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("paths edge cases", () => {
  it("resolveProjectPathSafe handles nested directories", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "rpgmv-path-test-"));
    mkdirSync(join(tempDir, "a", "b", "c"), { recursive: true });
    writeFileSync(join(tempDir, "a", "b", "c", "test.json"), "{}");

    const result = resolveProjectPathSafe(tempDir, "a/b/c/test.json");
    expect(result).toContain("a");
    expect(result).toContain("b");
    expect(result).toContain("c");
  });

  it("normalizePath handles empty string", () => {
    expect(normalizePath("")).toBe("");
  });
});
