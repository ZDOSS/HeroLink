import { existsSync, mkdirSync, readFileSync, renameSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileChannel } from "../../src/channel/fileChannel.js";
import { parsePluginsJs, serializePluginsJs } from "../../src/io/pluginsJs.js";
import { loadProject } from "../../src/io/project.js";
import { hashFile } from "../../src/model/hash.js";
import { applyPatch } from "../../src/mutate/apply.js";
import { Backup } from "../../src/mutate/backup.js";
import { rollbackLastPatch } from "../../src/mutate/rollback.js";
import { Staging } from "../../src/mutate/staging.js";
import {
  compileCommand,
  compileCommandList,
  ConstrainedCommandSchema,
} from "../../src/schema/commands.js";
import { AddPluginDraftInput, addPluginDraft } from "../../src/tools/addPluginDraft.js";
import { CreateItemDraftInput, createItemDraft } from "../../src/tools/createItemDraft.js";
import { UpdateEntityDraftInput, updateEntityDraft } from "../../src/tools/updateEntityDraft.js";
import {
  UpdateMapEventDraftInput,
  updateMapEventDraft,
} from "../../src/tools/updateMapEventDraft.js";
import { validateProjectRefs } from "../../src/tools/validateProjectRefs.js";
import { withTempProject } from "../helpers/withTempProject.js";

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(Object.prototype, "auditPrototypeFlag");
});

describe("audit regressions", () => {
  it.each(["../../../audit-outside", "..\\..\\..\\audit-outside"])(
    "refuses plugin traversal: %s",
    async (name) => {
      await withTempProject("sample-project", async (dir) => {
        const p = loadProject(dir);
        await expect(async () => {
          addPluginDraft(p, p.staging, AddPluginDraftInput.parse({ name, source: "// test" }));
          await applyPatch(p, p.staging);
        }).rejects.toThrow();
        expect(existsSync(join(dir, "..", "audit-outside.js"))).toBe(false);
      });
    },
  );

  it("refuses a project data directory that escapes through a symlink", async () => {
    await withTempProject("sample-project", async (dir) => {
      const outside = join(dir, "..", "outside-data");
      renameSync(join(dir, "data"), outside);
      symlinkSync(outside, join(dir, "data"), "dir");
      expect(() => loadProject(dir)).toThrow(/escapes/);
    });
  });

  it("refuses prototype traversal through a schema-parsed update", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const item = p.model.listEntities("Item")[0];
      await expect(async () => {
        updateEntityDraft(
          p,
          p.staging,
          UpdateEntityDraftInput.parse({
            type: "Item",
            id: item.id,
            patch: { "__proto__/auditPrototypeFlag": true },
          }),
        );
        await applyPatch(p, p.staging);
      }).rejects.toThrow();
      expect(Object.hasOwn(Object.prototype, "auditPrototypeFlag")).toBe(false);
    });
  });

  it("refuses incomplete creation without saving a draft", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      expect(() =>
        createItemDraft(
          p,
          p.staging,
          CreateItemDraftInput.parse({ fields: { name: "Incomplete" } }),
        ),
      ).toThrow();
      expect(p.staging.list()).toEqual([]);
    });
  });

  it("validates pending references and refuses an invalid changeset", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const actor = p.model.listEntities("Actor")[0];
      const missing = Math.max(...p.model.listEntities("Class").map((e) => e.id)) + 1;
      p.staging.addUpdate("Actor", actor.id, { classId: missing });
      const before = hashFile(join(dir, "data", "Actors.json"));
      expect(validateProjectRefs(p, { includePending: true }).ok).toBe(false);
      await expect(applyPatch(p, p.staging)).rejects.toThrow();
      expect(hashFile(join(dir, "data", "Actors.json"))).toBe(before);
    });
  });

  it("shares drafts between independent project sessions without overwriting", async () => {
    await withTempProject("sample-project", async (dir) => {
      const a = loadProject(dir);
      const b = loadProject(dir);
      const { id: _id, ...item } = a.model.listEntities("Item")[0];
      const aId = a.staging.addCreate("Item", { ...item, name: "First" });
      expect(b.staging.list().map((d) => d.changeId)).toContain(aId);
      const bId = b.staging.addCreate("Item", { ...item, name: "Second" });
      expect(a.staging.list().map((d) => d.changeId)).toEqual([aId, bId]);
      await applyPatch(a, a.staging);
      expect(b.staging.list()).toEqual([]);
      expect(
        a.model.listEntities("Item").filter((e) => ["First", "Second"].includes(e.name)),
      ).toHaveLength(2);
    });
  });

  it("restores an existing unregistered plugin from its backup", async () => {
    await withTempProject("sample-project", async (dir) => {
      const file = join(dir, "js", "plugins", "Existing.js");
      writeFileAtomic.sync(file, "// original");
      const p = loadProject(dir);
      addPluginDraft(
        p,
        p.staging,
        AddPluginDraftInput.parse({ name: "Existing", source: "// replacement" }),
      );
      await applyPatch(p, p.staging);
      rollbackLastPatch(p);
      expect(readFileSync(file, "utf8")).toBe("// original");
    });
  });

  it("refuses rollback over a later editor change", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const item = p.model.listEntities("Item")[0];
      p.staging.addUpdate("Item", item.id, { name: "Applied" });
      await applyPatch(p, p.staging);
      const file = join(dir, "data", "Items.json");
      const edited = JSON.parse(readFileSync(file, "utf8"));
      edited[item.id].description = "Later editor change";
      writeFileAtomic.sync(file, JSON.stringify(edited));
      const editedHash = hashFile(file);
      expect(() => rollbackLastPatch(p)).toThrow();
      expect(hashFile(file)).toBe(editedHash);
    });
  });

  it("removes new files when a subsequent write fails", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      addPluginDraft(p, p.staging, AddPluginDraftInput.parse({ name: "New", source: "// new" }));
      const original = writeFileAtomic.sync;
      let failed = false;
      vi.spyOn(writeFileAtomic, "sync").mockImplementation((file, ...args) => {
        if (file === join(dir, "js", "plugins.js") && !failed) {
          failed = true;
          throw new Error("injected failure");
        }
        return original(file, ...args);
      });
      await expect(applyPatch(p, p.staging)).rejects.toThrow(/injected/);
      expect(existsSync(join(dir, "js", "plugins", "New.js"))).toBe(false);
      expect(new Backup(dir).listTransactions()).toEqual([]);
      expect(p.staging.list()).toHaveLength(1);
    });
  });

  it("restores journal and staging when staging clear fails", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const item = p.model.listEntities("Item")[0];
      p.staging.addUpdate("Item", item.id, { name: "Applied" });
      const before = hashFile(join(dir, "data", "Items.json"));
      const original = writeFileAtomic.sync;
      let failed = false;
      vi.spyOn(writeFileAtomic, "sync").mockImplementation((file, ...args) => {
        if (file === join(dir, ".bridge", "staging.json") && !failed) {
          failed = true;
          throw new Error("injected staging failure");
        }
        return original(file, ...args);
      });
      await expect(applyPatch(p, p.staging)).rejects.toThrow(/injected/);
      expect(hashFile(join(dir, "data", "Items.json"))).toBe(before);
      expect(new Backup(dir).listTransactions()).toEqual([]);
      expect(p.staging.list()).toHaveLength(1);
      expect(new Staging(dir).list()).toHaveLength(1);
    });
  });

  it("composes page patches across drafts", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const mapId = p.model.listMapInfos()[0].id;
      const event = p.model.getMapEvents(mapId)[0];
      const page = event.pages[0] as { moveSpeed: number; directionFix: boolean };
      updateMapEventDraft(
        p,
        p.staging,
        UpdateMapEventDraftInput.parse({
          mapId,
          eventId: event.id,
          pageIndex: 0,
          page: { moveSpeed: page.moveSpeed + 1 },
        }),
      );
      updateMapEventDraft(
        p,
        p.staging,
        UpdateMapEventDraftInput.parse({
          mapId,
          eventId: event.id,
          pageIndex: 0,
          page: { directionFix: !page.directionFix },
        }),
      );
      await applyPatch(p, p.staging);
      expect(p.model.getMapEvents(mapId)[0].pages[0]).toMatchObject({
        moveSpeed: page.moveSpeed + 1,
        directionFix: !page.directionFix,
      });
    });
  });

  it.each(["[", "]", "text [ without a matching bracket", '\\"['])(
    "roundtrips plugin text %s",
    (text) => {
      const entries = [{ name: "Plugin", status: true, description: text, parameters: { text } }];
      expect(parsePluginsJs(serializePluginsJs(entries))).toEqual(entries);
    },
  );

  it("rejects a missing referenced map", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const mapId = p.model.listMapInfos()[0].id;
      const file = `Map${String(mapId).padStart(3, "0")}.json`;
      renameSync(join(dir, "data", file), join(dir, "..", file));
      expect(() => loadProject(dir)).toThrow(/Map/);
    });
  });

  it("does not consume responses while another process holds the lock", async () => {
    await withTempProject("sample-project", async (dir) => {
      const channel = new FileChannel(dir);
      const id = channel.sendCommand("INSPECT");
      const file = join(dir, ".bridge", "responses.json");
      const responses = [{ id, command: "INSPECT", success: true, result: {}, error: null }];
      writeFileAtomic.sync(file, JSON.stringify(responses));
      mkdirSync(join(dir, ".bridge", "responses.lock"));
      await channel.waitForResponse(id, 40);
      expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(responses);
    });
  });

  it("encodes HP subtraction and variable/actor conditions correctly", () => {
    const hp = compileCommand(
      ConstrainedCommandSchema.parse({
        type: "changeHp",
        actorId: 1,
        operation: "decrease",
        operand: 10,
      }),
    )[0];
    expect(hp.parameters.slice(2, 5)).toEqual([1, 0, 10]);
    const variable = compileCommand(
      ConstrainedCommandSchema.parse({
        type: "conditionalBranch",
        conditionType: "variable",
        variableId: 1,
        variableOp: 1,
        variableValue: 10,
      }),
    )[0];
    expect(variable.parameters).toEqual([1, 1, 0, 10, 1]);
    const actor = compileCommand(
      ConstrainedCommandSchema.parse({
        type: "conditionalBranch",
        conditionType: "actor",
        actorId: 1,
      }),
    )[0];
    expect(actor.parameters[0]).toBe(4);
  });

  it("compiles branch bodies at a nested indent", () => {
    const commands = compileCommandList([
      ConstrainedCommandSchema.parse({
        type: "conditionalBranch",
        conditionType: "switch",
        switchId: 1,
        switchValue: true,
        then: [{ type: "changeGold", operation: "increase", operand: 10 }],
      }),
    ]);
    expect(commands.find((c) => c.code === 125)?.indent).toBe(1);
    expect(commands.some((c) => c.code === 412)).toBe(true);
  });
});
