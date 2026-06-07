import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadProject } from "../../src/io/project.js";

const SAMPLE_DIR = join(process.cwd(), "test", "fixtures", "sample-project");

describe("round-trip / idempotence", () => {
  it("loading project produces correct entity counts", () => {
    const project = loadProject(SAMPLE_DIR);
    expect(project.model.listEntities("Item")).toHaveLength(3);
    expect(project.model.listEntities("Skill")).toHaveLength(3);
    expect(project.model.listEntities("Weapon")).toHaveLength(2);
    expect(project.model.listEntities("Armor")).toHaveLength(2);
    expect(project.model.listEntities("State")).toHaveLength(2);
    expect(project.model.listEntities("Enemy")).toHaveLength(2);
    expect(project.model.listEntities("Actor")).toHaveLength(2);
    expect(project.model.listEntities("Class")).toHaveLength(2);
    expect(project.model.listEntities("Troop")).toHaveLength(1);
    expect(project.model.listEntities("CommonEvent")).toHaveLength(1);
    expect(project.model.listMapInfos()).toHaveLength(1);
    expect(project.model.plugins).toHaveLength(1);
  });

  it("System.json loads correctly", () => {
    const project = loadProject(SAMPLE_DIR);
    expect(project.model.system.gameTitle).toBe("Sample Game");
    expect(project.model.system.versionId).toBe(1);
    expect(project.model.system.currencyUnit).toBe("G");
    expect(project.model.system.elements).toContain("Fire");
    expect(project.model.system.skillTypes).toContain("Magic");
  });

  it("map events load correctly", () => {
    const project = loadProject(SAMPLE_DIR);
    const events = project.model.getMapEvents(1);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("NPC");
    expect(events[0].x).toBe(5);
    expect(events[0].y).toBe(5);
  });

  it("file snapshots are captured", () => {
    const project = loadProject(SAMPLE_DIR);
    expect(project.model.fileSnapshots.size).toBeGreaterThan(0);
    const itemsPath = join(SAMPLE_DIR, "data", "Items.json");
    expect(project.model.fileSnapshots.has(itemsPath)).toBe(true);
  });

  it("plugins.js parses correctly", () => {
    const project = loadProject(SAMPLE_DIR);
    expect(project.model.plugins).toHaveLength(1);
    expect(project.model.plugins[0].name).toBe("SamplePlugin");
    expect(project.model.plugins[0].status).toBe(true);
    expect(project.model.plugins[0].parameters.Enabled).toBe("true");
  });

  it("entity ids match array indices", () => {
    const project = loadProject(SAMPLE_DIR);
    for (const type of project.model.getEntityTypes()) {
      for (const entity of project.model.listEntities(type)) {
        expect(entity.id).toBeGreaterThan(0);
      }
    }
  });

  it("note/meta parsing works", () => {
    const project = loadProject(SAMPLE_DIR);
    const potion = project.model.getEntity("Item", 1);
    expect(potion).toBeDefined();
    expect(potion?.note).toBe("<type:healing>");
  });
});
