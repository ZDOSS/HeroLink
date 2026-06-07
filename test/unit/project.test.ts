import { describe, it, expect } from "vitest";
import { loadProject, findProjectDir } from "../../src/io/project.js";
import { ProjectNotFoundError } from "../../src/errors.js";
import { withTempProject } from "../helpers/withTempProject.js";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("project", () => {
  it("loads sample project successfully", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      expect(project.adapter.id).toBe("mv");
      expect(project.model.system.gameTitle).toBe("Sample Game");
    });
  });

  it("throws on missing project", () => {
    expect(() => loadProject("/nonexistent/path")).toThrow(ProjectNotFoundError);
  });

  it("creates .bridge directory on load", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      loadProject(projectDir);
      const { existsSync } = await import("node:fs");
      const { join } = await import("node:path");
      expect(existsSync(join(projectDir, ".bridge"))).toBe(true);
    });
  });

  it("findProjectDir finds project from subdirectory", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const subDir = join(projectDir, "data");
      const found = findProjectDir(subDir);
      expect(found).toBe(projectDir);
    });
  });

  it("findProjectDir throws when not found", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "rpgmv-no-project-"));
    expect(() => findProjectDir(tempDir)).toThrow(ProjectNotFoundError);
  });

  it("loadProject throws for directory without Game.rpgproject", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "rpgmv-no-marker-"));
    expect(() => loadProject(tempDir)).toThrow(ProjectNotFoundError);
  });
});
