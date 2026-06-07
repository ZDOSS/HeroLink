import { describe, it, expect } from "vitest";
import { loadProject } from "../../src/io/project.js";
import { validateProject } from "../../src/validate/project.js";
import { join } from "node:path";

const SAMPLE_DIR = join(process.cwd(), "test", "fixtures", "sample-project");
const BROKEN_DIR = join(process.cwd(), "test", "fixtures", "broken-project");

describe("reference integrity", () => {
  it("sample-project has zero issues", () => {
    const project = loadProject(SAMPLE_DIR);
    const result = validateProject(project.model);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("broken-project detects dangling animationId", () => {
    const project = loadProject(BROKEN_DIR);
    const result = validateProject(project.model);
    const animIssue = result.issues.find(
      (i) => i.refKind === "animationId" && i.location === "Skill:1",
    );
    expect(animIssue).toBeDefined();
    expect(animIssue?.severity).toBe("error");
    expect(animIssue?.message).toContain("99");
  });

  it("broken-project detects dangling skillId in class learning", () => {
    const project = loadProject(BROKEN_DIR);
    const result = validateProject(project.model);
    const skillIssue = result.issues.find(
      (i) => i.refKind === "skillId" && i.location === "Class:1:learning",
    );
    expect(skillIssue).toBeDefined();
    expect(skillIssue?.severity).toBe("error");
    expect(skillIssue?.message).toContain("50");
  });

  it("broken-project detects duplicate id", () => {
    const project = loadProject(BROKEN_DIR);
    const result = validateProject(project.model);
    const dupIssue = result.issues.find(
      (i) => i.refKind === "duplicateId" && i.location === "Item:1",
    );
    expect(dupIssue).toBeDefined();
    expect(dupIssue?.severity).toBe("error");
  });

  it("broken-project detects id/index mismatch", () => {
    const project = loadProject(BROKEN_DIR);
    const result = validateProject(project.model);
    const mismatchIssue = result.issues.find(
      (i) => i.refKind === "idIndexMismatch",
    );
    expect(mismatchIssue).toBeDefined();
    expect(mismatchIssue?.severity).toBe("error");
  });

  it("broken-project detects malformed note", () => {
    const project = loadProject(BROKEN_DIR);
    const result = validateProject(project.model);
    const noteIssue = result.issues.find(
      (i) => i.refKind === "malformedNote" && i.location === "Skill:1",
    );
    expect(noteIssue).toBeDefined();
    expect(noteIssue?.severity).toBe("warn");
  });

  it("broken-project detects non-string plugin param", () => {
    const project = loadProject(BROKEN_DIR);
    const result = validateProject(project.model);
    const pluginIssue = result.issues.find(
      (i) => i.refKind === "pluginParamType" && i.location === "Plugin:BadPlugin",
    );
    expect(pluginIssue).toBeDefined();
    expect(pluginIssue?.severity).toBe("warn");
  });

  it("broken-project reports ok=false when errors exist", () => {
    const project = loadProject(BROKEN_DIR);
    const result = validateProject(project.model);
    expect(result.ok).toBe(false);
    expect(result.issues.filter((i) => i.severity === "error").length).toBeGreaterThan(0);
  });

  it("detects exactly the expected number of issues in broken-project", () => {
    const project = loadProject(BROKEN_DIR);
    const result = validateProject(project.model);
    const errors = result.issues.filter((i) => i.severity === "error");
    const warns = result.issues.filter((i) => i.severity === "warn");
    expect(errors).toHaveLength(4);
    expect(warns).toHaveLength(2);
  });
});
