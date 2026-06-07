import { describe, it, expect } from "vitest";
import { resolveProjectPath, resolveProjectPathSafe, normalizePath } from "../../src/io/paths.js";
import { PathEscapeError } from "../../src/errors.js";
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("paths", () => {
  it("normalizePath converts backslashes to forward slashes", () => {
    expect(normalizePath("foo\\bar\\baz")).toBe("foo/bar/baz");
    expect(normalizePath("foo/bar/baz")).toBe("foo/bar/baz");
  });

  it("resolveProjectPathSafe resolves relative paths", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "rpgmv-path-test-"));
    mkdirSync(join(tempDir, "data"), { recursive: true });
    writeFileSync(join(tempDir, "data", "test.json"), "{}");

    const result = resolveProjectPathSafe(tempDir, "data/test.json");
    expect(result).toContain("data");
    expect(result).toContain("test.json");
  });

  it("resolveProjectPathSafe rejects path traversal", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "rpgmv-path-test-"));
    expect(() => resolveProjectPathSafe(tempDir, "../../etc/passwd")).toThrow(PathEscapeError);
  });

  it("resolveProjectPathSafe rejects absolute paths outside root", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "rpgmv-path-test-"));
    expect(() => resolveProjectPathSafe(tempDir, "/etc/passwd")).toThrow(PathEscapeError);
  });

  it("resolveProjectPath resolves paths with realpath", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "rpgmv-path-test-"));
    mkdirSync(join(tempDir, "data"), { recursive: true });
    writeFileSync(join(tempDir, "data", "test.json"), "{}");

    const result = resolveProjectPath(tempDir, "data/test.json");
    const expected = realpathSync(join(tempDir, "data", "test.json"));
    expect(result).toBe(expected);
  });
});
