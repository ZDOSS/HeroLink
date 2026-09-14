import { describe, expect, it } from "vitest";
import { readFileSync, existsSync, symlinkSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { loadProject } from "../../src/io/project.js";
import { callTool } from "../../src/tools/registry.js";
import { withTempProject } from "../helpers/withTempProject.js";

describe("independent patch review regressions", () => {
  it("refreshes a previously opened session after another session applies and drafts again", async () => {
    await withTempProject("sample-project", async (dir) => {
      const a = loadProject(dir),
        b = loadProject(dir);
      const item = a.model.listEntities("Item")[0];
      await callTool(a, "update_entity_draft", {
        type: "Item",
        id: item.id,
        patch: { name: "Committed name" },
      });
      let diff: any = await callTool(a, "diff_pending_changes");
      await callTool(a, "apply_patch", { confirm: true, expectedRevision: diff.revision });
      await callTool(a, "update_entity_draft", {
        type: "Item",
        id: item.id,
        patch: { description: "Next draft" },
      });
      diff = await callTool(b, "diff_pending_changes");
      expect(JSON.parse(diff.files[0].after)[item.id].name).toBe("Committed name");
      await callTool(b, "apply_patch", { confirm: true, expectedRevision: diff.revision });
      const saved = JSON.parse(readFileSync(join(dir, "data/Items.json"), "utf8"))[item.id];
      expect(saved).toMatchObject({ name: "Committed name", description: "Next draft" });
    });
  });
  it("rejects missing trait references before any target write", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const actor = p.model.listEntities("Actor")[0];
      const missing = Math.max(...p.model.listEntities("Skill").map((e) => e.id)) + 1;
      const draft: any = await callTool(p, "update_entity_draft", {
        type: "Actor",
        id: actor.id,
        patch: { traits: [{ code: 43, dataId: missing, value: 1 }] },
      });
      expect(draft.validation.ok).toBe(false);
      const before = readFileSync(join(dir, "data/Actors.json"), "utf8");
      const diff: any = await callTool(p, "diff_pending_changes");
      await expect(
        callTool(p, "apply_patch", { confirm: true, expectedRevision: diff.revision }),
      ).rejects.toThrow(/integrity/);
      expect(readFileSync(join(dir, "data/Actors.json"), "utf8")).toBe(before);
    });
  });
  it("preserves slash and tilde in plugin parameter names through apply", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const name = p.model.plugins[0].name;
      const params = { "Width/Height": "16:9", "~Label": "test" };
      await callTool(p, "set_plugin_param_draft", { pluginName: name, params });
      const diff: any = await callTool(p, "diff_pending_changes");
      await callTool(p, "apply_patch", { confirm: true, expectedRevision: diff.revision });
      expect(p.model.plugins[0].parameters).toMatchObject(params);
    });
  });
  it.each(["prepared", "committed"])(
    "refuses a fabricated %s recovery manifest with no backup or journal",
    async (phase) => {
      await withTempProject("sample-project", async (dir) => {
        loadProject(dir);
        const file = "data/Actors.json";
        const before = readFileSync(join(dir, file), "utf8");
        const actors = JSON.parse(before);
        actors.find(Boolean).classId = 999;
        const manifest = {
          version: 1,
          id: "t-123-abcd",
          phase,
          files: [{ file, before, after: JSON.stringify(actors) }],
        };
        const path = join(dir, ".bridge/transaction.json");
        writeFileAtomic.sync(path, JSON.stringify(manifest));
        expect(() => loadProject(dir)).toThrow();
        expect(readFileSync(join(dir, file), "utf8")).toBe(before);
        expect(existsSync(path)).toBe(true);
      });
    },
  );
  it("composes nested page fields across drafts without replacing siblings", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const [mapId, map] = [...p.model.maps][0];
      const event = map.events.find(Boolean)!;
      const before = structuredClone(event.pages[0]);
      for (const page of [{ conditions: { variableValue: 9 } }, { image: { pattern: 2 } }])
        await callTool(p, "update_map_event_draft", {
          mapId,
          eventId: event.id,
          pageIndex: 0,
          page,
        });
      const diff: any = await callTool(p, "diff_pending_changes");
      await callTool(p, "apply_patch", { confirm: true, expectedRevision: diff.revision });
      expect(p.model.getMapEvents(mapId)[0].pages[0]).toEqual({
        ...before,
        conditions: { ...before.conditions, variableValue: 9 },
        image: { ...before.image, pattern: 2 },
      });
    });
  });
  it("rejects internal symlink aliases as well as escapes", async () => {
    await withTempProject("sample-project", async (dir) => {
      const file = join(dir, "data/Items.json");
      renameSync(file, join(dir, "data/Alias.json"));
      symlinkSync("Alias.json", file);
      expect(() => loadProject(dir)).toThrow(/escapes/);
    });
  });
  it("reports missing enabled plugin files and preserves disabled entries", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const plugin = p.model.plugins.find((p) => p.status)!;
      const source = join(dir, "js/plugins", plugin.name + ".js");
      rmSync(source);
      expect(() => loadProject(dir)).toThrow(/Referenced enabled plugin source is missing/);
      const { serializePluginsJs } = await import("../../src/io/pluginsJs.js");
      plugin.status = false;
      writeFileAtomic.sync(join(dir, "js/plugins.js"), serializePluginsJs(p.model.plugins));
      expect(loadProject(dir).model.plugins.find((p) => p.name === plugin.name)?.status).toBe(
        false,
      );
    });
  });

  it("refuses a project root replaced with a symlink after the session opens", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const moved = join(dir, "..", "moved-project");
      renameSync(dir, moved);
      symlinkSync(moved, dir, "dir");
      expect(() => p.staging.list()).toThrow(/escapes/);
      expect(loadProject(dir).projectDir).toBe(moved);
    });
  });

  it.each(["public", "stored"])(
    "rejects dangerous keys before schema normalization at the %s boundary",
    async (boundary) => {
      await withTempProject("sample-project", async (dir) => {
        const p = loadProject(dir);
        const item = p.model.listEntities("Item")[0];
        const patch = JSON.parse('{"__proto__":{"polluted":true},"name":"Must not be staged"}');
        if (boundary === "public") {
          await expect(
            callTool(p, "update_entity_draft", { type: "Item", id: item.id, patch }),
          ).rejects.toThrow();
          expect(p.staging.list()).toEqual([]);
        } else {
          p.staging.addUpdate("Item", item.id, { name: "Original draft" });
          const state = p.staging.read();
          state.drafts[0].patch = patch;
          writeFileAtomic.sync(join(dir, ".bridge/staging.json"), JSON.stringify(state));
          expect(() => p.staging.list()).toThrow();
        }
        expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
      });
    },
  );
});
