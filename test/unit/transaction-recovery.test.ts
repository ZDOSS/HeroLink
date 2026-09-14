import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import writeFileAtomic from "write-file-atomic";
import { loadProject } from "../../src/io/project.js";
import { applyPatch, recoverInterruptedTransaction } from "../../src/mutate/apply.js";
import { rollbackLastPatch } from "../../src/mutate/rollback.js";
import { Backup } from "../../src/mutate/backup.js";
import { hashFile } from "../../src/model/hash.js";
import { Staging } from "../../src/mutate/staging.js";
import { withProjectLock } from "../../src/io/lock.js";
import { withTempProject } from "../helpers/withTempProject.js";

afterEach(() => vi.restoreAllMocks());

describe.each(["before", "after"])("apply write failure %s rename", (when) => {
  it.each([
    "Items.json",
    "js/plugins/NewPlugin.js",
    "js/plugins.js",
    ".bridge/journal.jsonl",
    ".bridge/staging.json",
  ])("restores all files and metadata when %s fails", async (suffix) => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const item = p.model.listEntities("Item")[0];
      p.staging.addUpdate("Item", item.id, { name: "Will be recovered" });
      p.staging.addAddPlugin("NewPlugin", "/* new */", true, {});
      const original = new Map(
        [...p.model.fileSnapshots].map(([file]) => [file, readFileSync(file, "utf8")]),
      );
      const drafts = p.staging.list();
      const write = writeFileAtomic.sync;
      let failed = false;
      vi.spyOn(writeFileAtomic, "sync").mockImplementation((file, data, options) => {
        if (
          !failed &&
          String(file).replaceAll("\\", "/").endsWith(suffix) &&
          !String(file).replaceAll("\\", "/").includes("/backups/")
        ) {
          failed = true;
          if (when === "after") write(file, data, options);
          throw new Error("injected rename failure");
        }
        return write(file, data, options);
      });
      await expect(applyPatch(p, p.staging)).rejects.toThrow("injected");
      for (const [file, before] of original) expect(readFileSync(file, "utf8")).toBe(before);
      expect(existsSync(join(dir, "js/plugins/NewPlugin.js"))).toBe(false);
      expect(new Backup(dir).listTransactions()).toEqual([]);
      expect(p.staging.list()).toEqual(drafts);
      expect(loadProject(dir).staging.list()).toEqual(drafts);
      expect(p.model.getEntity("Item", item.id)?.name).toBe(item.name);
    });
  });
});

describe("restart recovery and rollback preflight", () => {
  it.each(["apply", "rollback"])("recovers a process that exits during %s", async (operation) => {
    await withTempProject("sample-project", async (dir) => {
      let p = loadProject(dir);
      const item = p.model.listEntities("Item")[0];
      p.staging.addUpdate("Item", item.id, { name: "Committed before interrupted rollback" });
      if (operation === "rollback") await applyPatch(p, p.staging);
      const before = hashFile(join(dir, "data/Items.json"));
      const journal = new Backup(dir).listTransactions();
      const pending = p.staging.list();
      const script = `import atomic from 'write-file-atomic'; import {loadProject} from './src/io/project.ts'; import {applyPatch} from './src/mutate/apply.ts'; import {rollbackLastPatch} from './src/mutate/rollback.ts'; const p=loadProject(process.argv[1]); const original=atomic.sync; atomic.sync=(file,...args)=>{ const result=original(file,...args); if(String(file).split(String.fromCharCode(92)).join('/').endsWith('/data/Items.json')&&!String(file).split(String.fromCharCode(92)).join('/').includes('/backups/')) process.exit(73); return result; }; if(process.argv[2]==='apply') await applyPatch(p,p.staging); else rollbackLastPatch(p);`;
      const child = spawnSync(
        process.execPath,
        ["--import", "tsx", "--input-type=module", "-e", script, dir, operation],
        { encoding: "utf8", timeout: 15000 },
      );
      expect(child.status, child.stderr).toBe(73);
      expect(existsSync(join(dir, ".bridge/transaction.json"))).toBe(true);
      p = loadProject(dir);
      expect(hashFile(join(dir, "data/Items.json"))).toBe(before);
      expect(new Backup(dir).listTransactions()).toEqual(journal);
      expect(p.staging.list()).toEqual(pending);
      expect(existsSync(join(dir, ".bridge/transaction.json"))).toBe(false);
      if (operation === "apply") await applyPatch(p, p.staging);
      else rollbackLastPatch(p);
    });
  });
  it.each(["missing", "corrupt"])("refuses a %s backup before touching any file", async (kind) => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const item = p.model.listEntities("Item")[0];
      p.staging.addUpdate("Item", item.id, { name: "Applied item" });
      p.staging.addSetPluginParams(p.model.plugins[0].name, { test: "applied" });
      const result = await applyPatch(p, p.staging);
      const path = join(result.backupDir, "js/plugins.js");
      if (kind === "missing") rmSync(path);
      else writeFileAtomic.sync(path, "corrupt");
      const hashes = [...p.model.fileSnapshots].map(([file]) => [file, hashFile(file)]);
      expect(() => rollbackLastPatch(p)).toThrow(/backup/);
      for (const [file, hash] of hashes) expect(hashFile(file)).toBe(hash);
      expect(new Backup(dir).listTransactions()).toHaveLength(1);
    });
  });
  it("refuses external edits during recovery instead of overwriting them", async () => {
    await withTempProject("sample-project", async (dir) => {
      const file = "data/Items.json";
      const before = readFileSync(join(dir, file), "utf8");
      const manifest = {
        version: 1,
        id: `t-${Date.now()}-abcd`,
        phase: "prepared",
        files: [{ file, before, after: "[]" }],
      };
      mkdirSync(join(dir, ".bridge"), { recursive: true });
      writeFileAtomic.sync(join(dir, ".bridge/transaction.json"), JSON.stringify(manifest));
      writeFileAtomic.sync(join(dir, file), "external edit");
      expect(() => recoverInterruptedTransaction(dir)).toThrow(/changed on disk/);
      expect(readFileSync(join(dir, file), "utf8")).toBe("external edit");
      expect(existsSync(join(dir, ".bridge/transaction.json"))).toBe(true);
    });
  });
  it("finishes a real committed manifest after process exit and rejects malformed state", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const item = p.model.listEntities("Item")[0];
      p.staging.addUpdate("Item", item.id, { name: "Recovered commit" });
      const script = `import atomic from 'write-file-atomic'; import {loadProject} from './src/io/project.ts'; import {applyPatch} from './src/mutate/apply.ts'; const p=loadProject(process.argv[1]); const original=atomic.sync; atomic.sync=(file,...args)=>{const result=original(file,...args); if(String(file).split(String.fromCharCode(92)).join('/').endsWith('/transaction.json') && JSON.parse(String(args[0])).phase==='committed') process.exit(73); return result;}; await applyPatch(p,p.staging);`;
      const child = spawnSync(
        process.execPath,
        ["--import", "tsx", "--input-type=module", "-e", script, dir],
        { encoding: "utf8", timeout: 15000 },
      );
      expect(child.status, child.stderr).toBe(73);
      const path = join(dir, ".bridge/transaction.json");
      expect(JSON.parse(readFileSync(path, "utf8")).phase).toBe("committed");
      const recovered = loadProject(dir);
      expect(recovered.model.getEntity("Item", item.id)?.name).toBe("Recovered commit");
      expect(recovered.staging.list()).toEqual([]);
      expect(new Backup(dir).listTransactions()).toHaveLength(1);
      expect(existsSync(path)).toBe(false);
      for (const raw of [
        "invalid",
        JSON.stringify({
          version: 1,
          id: "t-123-abcd",
          phase: "committed",
          files: [{ file: "../escaped.js", before: null, after: "bad" }],
        }),
      ]) {
        writeFileAtomic.sync(path, raw);
        expect(() => recoverInterruptedTransaction(dir)).toThrow();
      }
    });
  });
});

describe("persistent input and path boundaries", () => {
  it.each(["../../../escape", "..\\..\\escape"])(
    "rejects a traversal plugin in stored drafts: %s",
    async (name) => {
      await withTempProject("sample-project", async (dir) => {
        const p = loadProject(dir);
        p.staging.addAddPlugin("Safe", "/* source */", true, {});
        const path = join(dir, ".bridge/staging.json");
        const state = JSON.parse(readFileSync(path, "utf8"));
        state.drafts[0].name = name;
        writeFileAtomic.sync(path, JSON.stringify(state));
        expect(() => new Staging(dir)).toThrow(/staging/);
      });
    },
  );
  it("preserves legacy pending state and refuses unverified legacy rollback", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const file = join(dir, ".bridge/staging.json");
      writeFileAtomic.sync(
        file,
        JSON.stringify({ drafts: [{ type: "create", changeId: randomUUID(), fields: {} }] }),
      );
      expect(() => new Staging(dir)).toThrow(/legacy/);
      expect(JSON.parse(readFileSync(file, "utf8")).drafts).toHaveLength(1);
      writeFileAtomic.sync(file, JSON.stringify({ drafts: [] }));
      expect(new Staging(dir).list()).toEqual([]);
      const target = join(dir, "data/Items.json");
      const backup = new Backup(dir);
      backup.recordTransaction(`t-${Date.now()}-abcd`, [target], { [target]: hashFile(target) });
      expect(() => rollbackLastPatch(p)).toThrow(/Legacy transaction/);
      writeFileAtomic.sync(join(dir, ".bridge/journal.jsonl"), "invalid\n");
      expect(() => backup.listTransactions()).toThrow(/journal/);
    });
  });
  it.each(["data", "js/plugins", ".bridge/backups"])(
    "rejects a symlink introduced after load at %s",
    async (relative) => {
      await withTempProject("sample-project", async (dir) => {
        const p = loadProject(dir);
        p.staging.addAddPlugin("Escaped", "/* source */", true, {});
        const outside = join(dir, "..", `outside-${randomUUID()}`);
        const target = join(dir, relative);
        if (existsSync(target)) renameSync(target, outside);
        else mkdirSync(outside);
        symlinkSync(outside, target, "dir");
        await expect(applyPatch(p, p.staging)).rejects.toThrow(/escapes/);
      });
    },
  );
  it("refuses a live lock and supports nested operations", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      expect(withProjectLock(dir, () => withProjectLock(dir, () => p.staging.list()))).toEqual([]);
      const lock = join(dir, ".bridge/project.lock");
      mkdirSync(lock);
      writeFileAtomic.sync(
        join(lock, "owner.json"),
        JSON.stringify({ pid: process.pid, token: randomUUID() }),
      );
      expect(() => p.staging.list()).toThrow(/busy/);
    });
  });
});
