import { readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import writeFileAtomic from "write-file-atomic";
import { loadProject } from "../../src/io/project.js";
import {
  applyPatch,
  recoverInterruptedTransaction,
  rollbackTransaction,
} from "../../src/mutate/apply.js";
import { prepareCandidate } from "../../src/mutate/candidate.js";
import { Backup } from "../../src/mutate/backup.js";
import { buildWritePlans, computeNextIds, entityFile } from "../../src/mutate/patch.js";
import { hashContent } from "../../src/model/hash.js";
import { compileCommandList, ConstrainedCommandSchema } from "../../src/schema/commands.js";
import { validateEntityFields, assertSafeKeys } from "../../src/schema/safety.js";
import { validateProjectRefs } from "../../src/tools/validateProjectRefs.js";
import { createEntityDraft } from "../../src/tools/createEntityDraft.js";
import { withTempProject } from "../helpers/withTempProject.js";
afterEach(() => vi.restoreAllMocks());
const cloned = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const journal = (m: any) => m.files.find((f: any) => f.file === ".bridge/journal.jsonl");
const stage = (m: any) => m.files.find((f: any) => f.file === ".bridge/staging.json");
const editJSON = (entry: any, key: string, edit: (value: any) => void) => {
  const value = JSON.parse(entry[key]);
  edit(value);
  entry[key] = JSON.stringify(value);
};
async function capture(dir: string, rollback = false) {
  const p = loadProject(dir),
    actor = p.model.listEntities("Actor")[0];
  p.staging.addUpdate("Actor", actor.id, { name: "Captured actor" });
  if (rollback) await applyPatch(p, p.staging);
  let manifest: any;
  let failed = false;
  const write = writeFileAtomic.sync;
  const mock = vi.spyOn(writeFileAtomic, "sync").mockImplementation((file, data, options) => {
    if (String(file).endsWith("transaction.json")) manifest = JSON.parse(String(data));
    if (
      !failed &&
      String(file).replaceAll("\\", "/").endsWith("data/Actors.json") &&
      !String(file).includes("backups")
    ) {
      failed = true;
      throw new Error("capture interruption");
    }
    return write(file, data, options);
  });
  try {
    if (rollback) expect(() => rollbackTransaction(p)).toThrow("capture interruption");
    else await expect(applyPatch(p, p.staging)).rejects.toThrow("capture interruption");
  } finally {
    mock.mockRestore();
  }
  expect(manifest).toBeDefined();
  return { p, manifest, actor };
}
const tampering: [string, (m: any) => void][] = [
  ["duplicate destinations", (m) => m.files.push(cloned(m.files[0]))],
  [
    "missing journal",
    (m) => (m.files = m.files.filter((f: any) => f.file !== ".bridge/journal.jsonl")),
  ],
  ["null journal", (m) => (journal(m).after = null)],
  ["wrong transaction ID", (m) => editJSON(journal(m), "after", (v) => (v.id = "t-123-abcd"))],
  ["missing staging bytes", (m) => (stage(m).before = null)],
  ["empty source drafts", (m) => editJSON(stage(m), "before", (v) => (v.drafts = []))],
  [
    "uncleared drafts",
    (m) => editJSON(stage(m), "after", (v) => (v.drafts = JSON.parse(stage(m).before).drafts)),
  ],
  ["missing baseline", (m) => editJSON(stage(m), "before", (v) => (v.baseHashes = {}))],
  [
    "invalid candidate",
    (m) => editJSON(stage(m), "before", (v) => (v.drafts[0].patch = { classId: 999 })),
  ],
  [
    "different validated bytes",
    (m) => {
      const file = m.files[0];
      editJSON(file, "after", (v) => (v.find(Boolean).name = "tampered"));
    },
  ],
  ["different journal file set", (m) => editJSON(journal(m), "after", (v) => (v.files = []))],
  [
    "wrong prehash",
    (m) => editJSON(journal(m), "after", (v) => (v.preHashes[v.files[0]] = "a".repeat(64))),
  ],
  [
    "wrong posthash",
    (m) => editJSON(journal(m), "after", (v) => (v.postHashes[v.files[0]] = "b".repeat(64))),
  ],
];

describe("persisted transaction proof", () => {
  it.each(tampering)("rejects %s without changing any project bytes", async (_name, tamper) => {
    await withTempProject("sample-project", async (dir) => {
      const { manifest } = await capture(dir);
      const before = readFileSync(join(dir, "data/Actors.json"), "utf8");
      tamper(manifest);
      const path = join(dir, ".bridge/transaction.json");
      writeFileAtomic.sync(path, JSON.stringify(manifest));
      expect(() => recoverInterruptedTransaction(dir)).toThrow();
      expect(readFileSync(join(dir, "data/Actors.json"), "utf8")).toBe(before);
      expect(existsSync(path)).toBe(true);
    });
  });
  it("refuses missing backups during restart recovery", async () => {
    await withTempProject("sample-project", async (dir) => {
      const { manifest } = await capture(dir);
      rmSync(join(new Backup(dir).getBackupDir(manifest.id), manifest.files[0].file));
      writeFileAtomic.sync(join(dir, ".bridge/transaction.json"), JSON.stringify(manifest));
      expect(() => recoverInterruptedTransaction(dir)).toThrow();
    });
  });
  it.each(["missing journal record", "mismatched file set", "corrupt restored bytes"])(
    "refuses rollback recovery with %s",
    async (kind) => {
      await withTempProject("sample-project", async (dir) => {
        const { manifest } = await capture(dir, true);
        const j = journal(manifest);
        if (kind === "missing journal record") j.before = "";
        if (kind === "mismatched file set")
          editJSON(j, "before", (v) => (v.files = [...v.files, ...v.files]));
        if (kind === "corrupt restored bytes")
          editJSON(manifest.files[0], "after", (v) => (v.find(Boolean).name = "corrupt"));
        writeFileAtomic.sync(join(dir, ".bridge/transaction.json"), JSON.stringify(manifest));
        expect(() => recoverInterruptedTransaction(dir)).toThrow();
      });
    },
  );
});

describe("mutation input boundaries", () => {
  it("checks backup path/hash sets and atomically records and removes transactions", async () => {
    await withTempProject("sample-project", async (dir) => {
      const backup = new Backup(dir),
        id = `t-${Date.now()}-abcd`,
        file = join(dir, "data/Items.json"),
        missing = join(dir, "js/plugins/Missing.js");
      const hashes = backup.createBackup(id, [file, missing]);
      expect(hashes[missing]).toBe("");
      expect(readFileSync(join(backup.getBackupDir(id), "data/Items.json"), "utf8")).toBe(
        readFileSync(file, "utf8"),
      );
      const record = {
        id,
        timestamp: new Date().toISOString(),
        files: [file],
        preHashes: hashes,
        postHashes: hashes,
      };
      for (const bad of [
        { ...record, files: [join(dir, "Game.rpgproject")] },
        { ...record, preHashes: {} },
        { ...record, postHashes: {} },
        { ...record, files: [file, file] },
      ])
        expect(() => backup.validate(bad)).toThrow();
      backup.recordTransaction(id, [file], hashes, hashes);
      expect(backup.getLastTransaction()?.id).toBe(id);
      expect(backup.backupExists(id)).toBe(true);
      backup.removeTransaction(id);
      expect(backup.listTransactions()).toEqual([]);
    });
  });
  it("rejects persisted raw commands, incomplete maps, unknown fields and conflicting destinations", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const mapId = [...p.model.maps.keys()][0];
      const event = p.model.getMapEvents(mapId)[0];
      const check = (draft: () => void) => {
        draft();
        expect(() => prepareCandidate(p, p.staging)).toThrow();
        p.staging.clear();
      };
      check(() => p.staging.addCreateMapEvent(mapId, { name: "Incomplete" }));
      const { id, ...eventFields } = event;
      const withRoute = cloned(eventFields) as any;
      withRoute.pages[0].moveRoute.list[0].code = 45;
      check(() => p.staging.addCreateMapEvent(mapId, withRoute));
      check(() => p.staging.addUpdateMapEvent(mapId, event.id, { pages: [] }));
      check(() =>
        p.staging.addUpdate("CommonEvent", p.model.listEntities("CommonEvent")[0].id, {
          list: compileCommandList([]),
        }),
      );
      check(() => {
        p.staging.addAddPlugin("CaseName", "/* first */", true, {});
        p.staging.addAddPlugin("casename", "/* second */", true, {});
      });
      p.staging.addAddPlugin("InvalidUtf8", "/* source */", true, {});
      writeFileAtomic.sync(join(dir, "js/plugins/InvalidUtf8.js"), Buffer.from([255]));
      // A fresh baseline lets the UTF-8 boundary (rather than staleness) reject it.
      const state = p.staging.read();
      state.baseHashes["js/plugins/InvalidUtf8.js"] = hashContent(Buffer.from([255]));
      p.staging.restore(state);
      expect(() => prepareCandidate(p, p.staging)).toThrow();
    });
  });
  it("validates builder-only fields and returns pending schema issues through the validation tool", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const troop = p.model.listEntities("Troop")[0] as any;
      const { id, ...fields } = troop;
      const created = createEntityDraft(p, p.staging, {
        type: "Troop",
        fields: {
          ...fields,
          pages: fields.pages.map(({ list, ...page }: any) => ({
            ...page,
            commands: [{ type: "wait", frames: 1 }],
          })),
        },
      });
      expect(created.preview.fields.id).toBe(troop.id + 1);
      expect(prepareCandidate(p, p.staging).validation.ok).toBe(true);
      p.staging.clear();
      p.staging.addCreate("Item", { name: "incomplete" });
      expect(
        validateProjectRefs(p, { includePending: true }).issues.some((i) => i.refKind === "schema"),
      ).toBe(true);
      for (const args of [
        ["Tileset", {}, false],
        ["Item", { id: 1 }, true],
        ["CommonEvent", { list: [] }, true, true],
      ])
        expect(() => validateEntityFields(...(args as any))).toThrow();
      for (const value of [
        JSON.parse('{"__proto__":{"polluted":true}}'),
        { constructor: { prototype: { polluted: true } } },
      ])
        expect(() => assertSafeKeys(value)).toThrow();
    });
  });
  it("rejects duplicate stored draft IDs and retains captured plugin hashes", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const path = join(dir, ".bridge/staging.json");
      p.staging.addUpdate("Item", p.model.listEntities("Item")[0].id, { name: "First" });
      const state = p.staging.read();
      state.drafts.push(cloned(state.drafts[0]));
      writeFileAtomic.sync(path, JSON.stringify(state));
      expect(() => p.staging.list()).toThrow(/Duplicate draft IDs/);
      writeFileAtomic.sync(path, JSON.stringify({ ...state, drafts: [] }));
      p.staging.clear();
      expect(p.staging.list()).toEqual([]);
    });
  });
  it("guards patch planning entrypoints before resolving any write", () => {
    const common = { changeId: randomUUID() };
    expect(() => entityFile("unsupported" as any)).toThrow();
    expect(
      computeNextIds(
        [{ ...common, type: "create", entityType: "Item", fields: {} }],
        new Map(),
      ).get("Item"),
    ).toBe(1);
    expect(() =>
      buildWritePlans(
        [{ ...common, type: "create", entityType: "Item", fields: {} }],
        new Map(),
        [],
        new Map(),
      ),
    ).toThrow(/No next ID/);
    expect(() =>
      buildWritePlans(
        [{ ...common, type: "update", entityType: "Item", entityId: 1, patch: { list: [] } }],
        new Map(),
        [],
        new Map(),
      ),
    ).toThrow();
    expect(() =>
      buildWritePlans(
        [{ ...common, type: "setPluginParams", pluginName: "Missing", params: {} }],
        new Map(),
        [],
        new Map(),
      ),
    ).toThrow();
    const plugin = { name: "Existing", status: true, description: "", parameters: {} };
    expect(() =>
      buildWritePlans(
        [
          {
            ...common,
            type: "addPlugin",
            name: plugin.name,
            status: true,
            source: "/*x*/",
            params: {},
          },
        ],
        new Map(),
        [plugin],
        new Map(),
      ),
    ).toThrow(/exists/);
    const unchanged = { ...plugin, name: "Unchanged" };
    const plans = buildWritePlans(
      [{ ...common, type: "setPluginParams", pluginName: plugin.name, params: { value: "new" } }],
      new Map(),
      [plugin, unchanged],
      new Map(),
    );
    expect((plans[0] as any).entries[1]).toEqual(unchanged);
  });
});
