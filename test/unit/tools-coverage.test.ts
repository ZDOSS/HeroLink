import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { withTempProject } from "../helpers/withTempProject.js";
import { loadProject } from "../../src/io/project.js";
import { listPendingChanges } from "../../src/tools/listPendingChanges.js";
import { listBackups } from "../../src/tools/listBackups.js";
import { searchEvents } from "../../src/tools/searchEvents.js";
import { updateEntityDraft } from "../../src/tools/updateEntityDraft.js";
import { applyPatch } from "../../src/mutate/apply.js";
import { createCommonEventDraft } from "../../src/tools/createCommonEventDraft.js";
import { createEntityDraft } from "../../src/tools/createEntityDraft.js";
import { setPluginParamDraft } from "../../src/tools/setPluginParamDraft.js";
import { addPluginDraft } from "../../src/tools/addPluginDraft.js";
import { createMapEventDraft } from "../../src/tools/createMapEventDraft.js";
import { updateMapEventDraft } from "../../src/tools/updateMapEventDraft.js";
import { discardPendingChanges } from "../../src/tools/discardPendingChanges.js";
import { createSkillDraft } from "../../src/tools/createSkillDraft.js";
import { Staging } from "../../src/mutate/staging.js";
import {
  ProjectNotFoundError,
  ValidationError,
  RefIntegrityError,
  ConflictError,
} from "../../src/errors.js";

const SAMPLE_DIR = join(process.cwd(), "test", "fixtures", "sample-project");

describe("listPendingChanges — all draft types", () => {
  it("returns empty list when no drafts exist", () => {
    const project = loadProject(SAMPLE_DIR);
    const result = listPendingChanges(project, project.staging);
    expect(result.changes).toEqual([]);
  });

  it("reports create drafts", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      createEntityDraft(project, project.staging, { type: "Item", fields: { name: "TestItem" } });
      const result = listPendingChanges(project, project.staging);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe("create");
      expect(result.changes[0].summary).toContain("TestItem");
    });
  });

  it("reports update drafts", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      updateEntityDraft(project, project.staging, { type: "Item", id: 1, patch: { name: "Updated" } });
      const result = listPendingChanges(project, project.staging);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe("update");
      expect(result.changes[0].summary).toContain("Item:1");
    });
  });

  it("reports createMapEvent drafts", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      createMapEventDraft(project, project.staging, { mapId: 1, name: "NewEvent", x: 5, y: 5, pages: [] });
      const result = listPendingChanges(project, project.staging);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe("createMapEvent");
      expect(result.changes[0].summary).toContain("NewEvent");
    });
  });

  it("reports updateMapEvent drafts", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      updateMapEventDraft(project, project.staging, { mapId: 1, eventId: 1, patch: { name: "Changed" } });
      const result = listPendingChanges(project, project.staging);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe("updateMapEvent");
      expect(result.changes[0].summary).toContain("event 1 on map 1");
    });
  });

  it("reports setPluginParams drafts", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      setPluginParamDraft(project, project.staging, { pluginName: "SamplePlugin", params: { key: "val" } });
      const result = listPendingChanges(project, project.staging);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe("setPluginParams");
      expect(result.changes[0].summary).toContain("SamplePlugin");
    });
  });

  it("reports addPlugin drafts", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      addPluginDraft(project, project.staging, { name: "MyPlugin", source: "/* code */", params: {} });
      const result = listPendingChanges(project, project.staging);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe("addPlugin");
      expect(result.changes[0].summary).toContain("MyPlugin");
    });
  });

  it("reports unnamed create draft correctly", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      createEntityDraft(project, project.staging, { type: "Item", fields: {} });
      const result = listPendingChanges(project, project.staging);
      expect(result.changes[0].summary).toContain("unnamed");
    });
  });
});

describe("updateEntityDraft — not found path", () => {
  it("throws when entity does not exist", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      expect(() =>
        updateEntityDraft(project, project.staging, { type: "Item", id: 9999, patch: { name: "Nope" } }),
      ).toThrow("Item with id 9999 not found");
    });
  });
});

describe("listBackups", () => {
  it("returns empty transactions when no journal exists", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      const result = listBackups(project);
      expect(result.transactions).toEqual([]);
    });
  });

  it("returns transactions after an apply", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      createCommonEventDraft(project, project.staging, {
        name: "BackupTest",
        trigger: 0,
        commands: [{ type: "showText", lines: ["hi"] }],
      });
      await applyPatch(project, project.staging);
      const result = listBackups(project);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].id).toBeDefined();
      expect(result.transactions[0].files.length).toBeGreaterThan(0);
    });
  });

  it("lists all transactions after multiple applies", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      let project = loadProject(projectDir);
      createCommonEventDraft(project, project.staging, {
        name: "First",
        trigger: 0,
        commands: [{ type: "showText", lines: ["a"] }],
      });
      await applyPatch(project, project.staging);
      project = loadProject(projectDir);
      createCommonEventDraft(project, project.staging, {
        name: "Second",
        trigger: 0,
        commands: [{ type: "showText", lines: ["b"] }],
      });
      await applyPatch(project, project.staging);
      const result = listBackups(project);
      expect(result.transactions).toHaveLength(2);
    });
  });
});

describe("searchEvents — scope coverage", () => {
  it("finds text with scope=common", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      let project = loadProject(projectDir);
      createCommonEventDraft(project, project.staging, {
        name: "SearchedEvent",
        trigger: 0,
        commands: [{ type: "showText", lines: ["UniqueSearchPhrase"] }],
      });
      await applyPatch(project, project.staging);
      project = loadProject(projectDir);
      const result = searchEvents(project, { query: "UniqueSearchPhrase", scope: "common" });
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].location).toContain("SearchedEvent");
    });
  });

  it("finds map event text", async () => {
    const project = loadProject(SAMPLE_DIR);
    const result = searchEvents(project, { query: "Hello", scope: "map" });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].location).toContain("NPC");
  });

  it("returns empty matches for non-matching query", () => {
    const project = loadProject(SAMPLE_DIR);
    const result = searchEvents(project, { query: "ZZZZnotfound" });
    expect(result.matches).toEqual([]);
  });

  it("searches comment commands (code 108)", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      let project = loadProject(projectDir);
      createCommonEventDraft(project, project.staging, {
        name: "CommentEvent",
        trigger: 0,
        commands: [{ type: "comment", lines: ["commentSearchText"] }],
      });
      await applyPatch(project, project.staging);
      project = loadProject(projectDir);
      const result = searchEvents(project, { query: "commentSearchText" });
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].snippet).toContain("commentSearchText");
    });
  });
});

const stagingCleanups: string[] = [];

afterEach(() => {
  for (const dir of stagingCleanups) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
  stagingCleanups.length = 0;
});

function freshStaging(): Staging {
  const dir = mkdtempSync(join(tmpdir(), "staging-test-"));
  stagingCleanups.push(dir);
  return new Staging(dir);
}

describe("discardPendingChanges", () => {
  it("discards all drafts when no changeIds given", () => {
    const staging = freshStaging();
    staging.addCreate("Item", { name: "Test" });
    const result = discardPendingChanges(null, staging, {});
    expect(result.remaining).toBe(0);
    expect(staging.list()).toHaveLength(0);
  });

  it("discards only specified changeIds", () => {
    const staging = freshStaging();
    const id1 = staging.addCreate("Item", { name: "Keep" });
    const id2 = staging.addCreate("Skill", { name: "Remove" });
    const result = discardPendingChanges(null, staging, { changeIds: [id2] });
    expect(result.remaining).toBe(1);
    expect(staging.list()[0].changeId).toBe(id1);
  });
});

describe("createSkillDraft", () => {
  it("creates a skill draft with correct ID", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      const result = createSkillDraft(project, project.staging, {
        fields: { name: "Fireball", damage: { type: 1, elementId: 1, formula: "a.mat * 4", variance: 20, critical: false } },
      });
      expect(result.changeId).toBeDefined();
      expect(result.preview.entityType).toBe("Skill");
      const existing = project.model.listEntities("Skill");
      const expectedNextId = existing.reduce((m, e) => Math.max(m, e.id), 0) + 1;
      expect(result.preview.fields.id).toBe(expectedNextId);
      expect(result.validation.ok).toBe(true);
    });
  });
});

describe("errors.ts constructors", () => {
  it("ProjectNotFoundError has correct properties", () => {
    const err = new ProjectNotFoundError("/some/path");
    expect(err.name).toBe("ProjectNotFoundError");
    expect(err.message).toContain("/some/path");
    expect(err.projectDir).toBe("/some/path");
  });

  it("ValidationError has correct properties", () => {
    const zodIssue = { path: ["name"], message: "Required", code: "invalid_type" };
    const err = new ValidationError([zodIssue as any]);
    expect(err.name).toBe("ValidationError");
    expect(err.issues).toHaveLength(1);
  });

  it("RefIntegrityError has correct properties", () => {
    const issue = { severity: "error", location: "Item:1", message: "test", refKind: "test" };
    const err = new RefIntegrityError([issue]);
    expect(err.name).toBe("RefIntegrityError");
    expect(err.issues).toHaveLength(1);
    expect(err.message).toContain("1 error(s)");
  });

  it("ConflictError has correct properties", () => {
    const err = new ConflictError("conflict occurred");
    expect(err.name).toBe("ConflictError");
    expect(err.message).toBe("conflict occurred");
  });
});
