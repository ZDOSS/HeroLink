import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withTempProject } from "../helpers/withTempProject.js";
import { loadProject } from "../../src/io/project.js";
import { applyPatch } from "../../src/mutate/apply.js";
import { rollbackLastPatch } from "../../src/mutate/rollback.js";
import { hashFile } from "../../src/model/hash.js";
import { createCommonEventDraft } from "../../src/tools/createCommonEventDraft.js";
import { createMapEventDraft } from "../../src/tools/createMapEventDraft.js";
import { updateMapEventDraft } from "../../src/tools/updateMapEventDraft.js";
import { setPluginParamDraft } from "../../src/tools/setPluginParamDraft.js";
import { addPluginDraft } from "../../src/tools/addPluginDraft.js";

describe("v4 events, maps & plugins", () => {
  describe("common events", () => {
    it("creates a common event with constrained commands", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);
        const cePath = join(projectDir, "data", "CommonEvents.json");
        const beforeHash = hashFile(cePath);

        const result = createCommonEventDraft(project, project.staging, {
          name: "Test Event",
          trigger: 0,
          switchId: 1,
          commands: [
            { type: "controlSwitches", startId: 1, endId: 1, value: true },
            { type: "showText", lines: ["Hello from common event!"] },
          ],
        });

        expect(result.changeId).toBeDefined();
        expect(result.preview.fields.id).toBe(2);

        await applyPatch(project, project.staging);
        expect(hashFile(cePath)).not.toBe(beforeHash);

        const afterData = JSON.parse(readFileSync(cePath, "utf-8"));
        const newEvent = afterData.find((e: { id: number } | null) => e !== null && e.id === 2);
        expect(newEvent).toBeDefined();
        expect(newEvent.name).toBe("Test Event");
        expect(newEvent.list.length).toBeGreaterThan(0);
        expect(newEvent.list[newEvent.list.length - 1].code).toBe(0);
      });
    });
  });

  describe("map events", () => {
    it("creates a map event with constrained commands", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);
        const mapPath = join(projectDir, "data", "Map001.json");
        const beforeHash = hashFile(mapPath);

        const result = createMapEventDraft(project, project.staging, {
          mapId: 1,
          name: "New NPC",
          x: 10,
          y: 10,
          pages: [
            {
              commands: [
                { type: "showText", lines: ["I'm a new NPC!"] },
              ],
            },
          ],
        });

        expect(result.changeId).toBeDefined();
        expect(result.preview.event.id).toBe(2);

        await applyPatch(project, project.staging);
        expect(hashFile(mapPath)).not.toBe(beforeHash);

        const afterData = JSON.parse(readFileSync(mapPath, "utf-8"));
        const newEvent = afterData.events.find((e: { id: number }) => e !== null && e.id === 2);
        expect(newEvent).toBeDefined();
        expect(newEvent.name).toBe("New NPC");
        expect(newEvent.x).toBe(10);
        expect(newEvent.y).toBe(10);
        expect(newEvent.pages[0].list.length).toBeGreaterThan(0);
        expect(newEvent.pages[0].list[newEvent.pages[0].list.length - 1].code).toBe(0);
      });
    });

    it("updates an existing map event", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);
        const mapPath = join(projectDir, "data", "Map001.json");

        const result = updateMapEventDraft(project, project.staging, {
          mapId: 1,
          eventId: 1,
          name: "Renamed NPC",
          x: 7,
          pageIndex: 0,
          page: {
            commands: [
              { type: "showText", lines: ["I've been updated!"] },
            ],
          },
        });

        expect(result.changeId).toBeDefined();

        await applyPatch(project, project.staging);

        const afterData = JSON.parse(readFileSync(mapPath, "utf-8"));
        const event = afterData.events.find((e: { id: number }) => e !== null && e.id === 1);
        expect(event.name).toBe("Renamed NPC");
        expect(event.x).toBe(7);
      });
    });

    it("map event apply → rollback restores original", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);
        const mapPath = join(projectDir, "data", "Map001.json");
        const beforeHash = hashFile(mapPath);

        createMapEventDraft(project, project.staging, {
          mapId: 1,
          name: "Temp NPC",
          x: 5,
          y: 5,
          pages: [
            {
              commands: [{ type: "comment", lines: ["Temporary"] }],
            },
          ],
        });

        await applyPatch(project, project.staging);
        expect(hashFile(mapPath)).not.toBe(beforeHash);

        rollbackLastPatch(project);
        expect(hashFile(mapPath)).toBe(beforeHash);
      });
    });
  });

  describe("plugins", () => {
    it("sets plugin parameters", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);
        const pluginsPath = join(projectDir, "js", "plugins.js");
        const beforeHash = hashFile(pluginsPath);

        const result = setPluginParamDraft(project, project.staging, {
          pluginName: "SamplePlugin",
          params: { Enabled: "false", MaxCount: "20" },
        });

        expect(result.changeId).toBeDefined();

        await applyPatch(project, project.staging);
        expect(hashFile(pluginsPath)).not.toBe(beforeHash);

        const reloaded = loadProject(projectDir);
        const plugin = reloaded.model.plugins.find((p) => p.name === "SamplePlugin");
        expect(plugin).toBeDefined();
        expect(plugin?.parameters.Enabled).toBe("false");
        expect(plugin?.parameters.MaxCount).toBe("20");
      });
    });

    it("adds a new plugin", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);
        const pluginsPath = join(projectDir, "js", "plugins.js");
        const pluginFilePath = join(projectDir, "js", "plugins", "NewPlugin.js");

        const result = addPluginDraft(project, project.staging, {
          name: "NewPlugin",
          source: "/* New Plugin */\nvar plugin = {};",
          status: true,
          params: { Key: "Value" },
        });

        expect(result.changeId).toBeDefined();

        await applyPatch(project, project.staging);

        const reloaded = loadProject(projectDir);
        const plugin = reloaded.model.plugins.find((p) => p.name === "NewPlugin");
        expect(plugin).toBeDefined();
        expect(plugin?.status).toBe(true);
        expect(plugin?.parameters.Key).toBe("Value");

        const sourceContent = readFileSync(pluginFilePath, "utf-8");
        expect(sourceContent).toContain("New Plugin");
      });
    });

    it("plugin add → rollback removes plugin", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);
        const pluginsPath = join(projectDir, "js", "plugins.js");
        const pluginFilePath = join(projectDir, "js", "plugins", "TempPlugin.js");
        const beforeHash = hashFile(pluginsPath);

        addPluginDraft(project, project.staging, {
          name: "TempPlugin",
          source: "/* Temp */",
          status: true,
          params: {},
        });

        await applyPatch(project, project.staging);
        expect(hashFile(pluginsPath)).not.toBe(beforeHash);

        rollbackLastPatch(project);
        expect(hashFile(pluginsPath)).toBe(beforeHash);

        const { existsSync } = require("node:fs");
        expect(existsSync(pluginFilePath)).toBe(false);
      });
    });

    it("rejects adding duplicate plugin", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);

        expect(() =>
          addPluginDraft(project, project.staging, {
            name: "SamplePlugin",
            source: "/* Duplicate */",
            status: true,
            params: {},
          }),
        ).toThrow("already exists");
      });
    });

    it("rejects setting params for nonexistent plugin", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);

        expect(() =>
          setPluginParamDraft(project, project.staging, {
            pluginName: "NonExistent",
            params: { Key: "Value" },
          }),
        ).toThrow("not found");
      });
    });
  });
});
