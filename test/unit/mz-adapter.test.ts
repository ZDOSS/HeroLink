import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { loadProject } from "../../src/io/project.js";

const MZ_DIR = join(process.cwd(), "test", "fixtures", "mz-sample-project");

describe("MZ adapter", () => {
  it("detects MZ project by Game.mzproject marker", () => {
    const project = loadProject(MZ_DIR);
    expect(project.adapter.id).toBe("mz");
  });

  it("loads all entity types from MZ project", () => {
    const project = loadProject(MZ_DIR);
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

  it("uses registered plugin command model", () => {
    const project = loadProject(MZ_DIR);
    expect(project.adapter.pluginCommandModel).toBe("registered");
  });

  it("loads MZ animations with effectName field", () => {
    const project = loadProject(MZ_DIR);
    const anims = project.model.listEntities("Animation");
    expect(anims.length).toBeGreaterThan(0);
    const fire = project.model.getEntity("Animation", 1);
    expect(fire).toBeDefined();
    expect((fire as Record<string, unknown>).effectName).toBeDefined();
  });

  it("supports map events on MZ project", () => {
    const project = loadProject(MZ_DIR);
    const events = project.model.getMapEvents(1);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("NPC");
  });

  it("handles read tools on MZ project", () => {
    const project = loadProject(MZ_DIR);
    const item = project.model.getEntity("Item", 1);
    expect(item).toBeDefined();
    expect(item?.name).toBe("Potion");
  });
});
