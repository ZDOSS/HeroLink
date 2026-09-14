import vm from "node:vm";
import * as fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import writeFileAtomic from "write-file-atomic";
import { describe, expect, it, vi } from "vitest";
import { withTempProject } from "../helpers/withTempProject.js";

const sourcePath = path.join(process.cwd(), "src/plugin/BridgeInspector.js");
function runtime(
  dir: string,
  options: {
    channel?: string;
    fs?: object;
    missingMain?: boolean;
    missingFs?: boolean;
    noGame?: boolean;
  } = {},
) {
  const messages: string[] = [];
  const actor = { actorId: () => 1, name: () => "Test actor", hp: 10, mp: 5, tp: 0, level: 1 };
  const context = vm.createContext({
    PluginManager: {
      parameters: () => ({
        "Channel Directory": options.channel ?? ".bridge",
        "Poll Interval": "1",
      }),
    },
    require: (name: string) => {
      if (options.missingFs) throw new Error("no NW.js");
      return name === "fs" ? (options.fs ?? fs) : path;
    },
    process: {
      pid: process.pid,
      mainModule: options.missingMain ? null : { filename: path.join(dir, "index.html") },
    },
    console: { error: vi.fn(), warn: vi.fn() },
    Game_Interpreter: function () {},
    Scene_Base: function () {},
    Scene_Map: function () {},
    Graphics: { frameCount: 1 },
    $dataSystem: { gameTitle: "Test", versionId: 1, switches: ["", "A"], variables: ["", "Text"] },
    $gameParty: { members: () => [actor], gold: () => 10 },
    $gameMap: { mapId: () => 1, displayName: () => "Test map" },
    $gamePlayer: { x: 1, y: 2, direction: () => 2 },
    $gameSwitches: { value: () => false },
    $gameVariables: { value: () => "A text variable" },
    $dataItems: [null, { name: "Item", description: "Description" }],
    $dataSkills: [null, { name: "Skill", description: "Description" }],
    $gameMessage: { add: (text: string) => messages.push(text), clear: () => messages.splice(0) },
  });
  context.Game_Interpreter.prototype.pluginCommand = () => {};
  context.Scene_Base.prototype.update = () => {};
  context.Scene_Map.prototype.start = () => {};
  if (options.noGame)
    for (const key of Object.keys(context).filter((k) => k.startsWith("$"))) context[key] = null;
  vm.runInContext(fs.readFileSync(sourcePath, "utf8"), context, { filename: sourcePath });
  const read = (file: string) =>
    JSON.parse(fs.readFileSync(path.join(dir, ".bridge", file), "utf8"));
  const write = (file: string, value: unknown) =>
    writeFileAtomic.sync(path.join(dir, ".bridge", file), JSON.stringify(value));
  const command = (name: string, args: object = {}, expiresAt = Date.now() + 10000) => ({
    id: randomUUID(),
    command: name,
    args,
    timestamp: Date.now(),
    expiresAt,
  });
  return {
    context,
    messages,
    read,
    write,
    command,
    start: () => context.Scene_Map.prototype.start(),
    tick: () => context.Scene_Base.prototype.update(),
    direct: (name: string, ...args: string[]) =>
      context.Game_Interpreter.prototype.pluginCommand("BridgeInspector", [name, ...args]),
  };
}

describe("actual runtime inspector plugin", () => {
  it("writes read-only state and supports every preview without replaying a command", async () => {
    await withTempProject("sample-project", async (dir) => {
      const r = runtime(dir);
      r.start();
      expect(r.read("runtime-state.json").variables).toEqual(["A text variable"]);
      const cmds = [
        r.command("INSPECT"),
        r.command("PREVIEW_ITEM", { itemId: 1 }),
        r.command("PREVIEW_SKILL", { skillId: 1 }),
      ];
      r.write("commands.json", cmds);
      r.tick();
      expect(r.read("responses.json").every((x: any) => x.success)).toBe(true);
      expect(r.messages).toEqual(["Preview: Item", "Description", "Preview: Skill", "Description"]);
      r.write("commands.json", cmds);
      r.tick();
      expect(r.messages).toHaveLength(4);
      expect(r.read("responses.json")).toHaveLength(3);
      r.write("commands.json", [r.command("CLEAR_PREVIEW")]);
      r.tick();
      expect(r.messages).toEqual([]);
      for (const [name, arg] of [
        ["INSPECT", ""],
        ["PREVIEW_ITEM", "1"],
        ["PREVIEW_SKILL", "1"],
        ["CLEAR_PREVIEW", ""],
      ])
        r.direct(name, arg);
      r.direct("__proto__");
      r.direct("");
      expect(r.context.console.warn).toHaveBeenCalledTimes(2);
      expect(
        fs
          .readdirSync(path.join(dir, ".bridge"))
          .some((f) => f.endsWith(".tmp") || f.endsWith(".lock")),
      ).toBe(false);
    });
  });
  it("refuses invalid, expired and cancelled previews and releases contended locks", async () => {
    await withTempProject("sample-project", async (dir) => {
      const r = runtime(dir);
      r.start();
      const expired = r.command("PREVIEW_ITEM", { itemId: 1 }, Date.now() - 1);
      const cancelled = r.command("PREVIEW_ITEM", { itemId: 1 });
      r.write(cancelled.id + ".cancelled", true);
      const invalid = [
        r.command("__proto__"),
        r.command("PREVIEW_ITEM"),
        r.command("PREVIEW_ITEM", { itemId: -1 }),
        r.command("PREVIEW_SKILL"),
        r.command("PREVIEW_SKILL", { skillId: 999 }),
      ];
      r.write("commands.json", [...invalid, expired, cancelled, null, { id: "malformed" }]);
      for (const lock of ["commands.lock", "responses.lock"]) {
        fs.mkdirSync(path.join(dir, ".bridge", lock));
        const before = r.read("commands.json");
        r.tick();
        expect(r.read("commands.json")).toEqual(before);
        fs.rmdirSync(path.join(dir, ".bridge", lock));
      }
      r.tick();
      expect(r.messages).toEqual([]);
      expect(r.read("responses.json")).toHaveLength(invalid.length);
      expect(r.read("responses.json").every((x: any) => x.success === false)).toBe(true);
      expect(fs.existsSync(path.join(dir, ".bridge", cancelled.id + ".cancelled"))).toBe(false);
      expect(r.read("commands.json")).toEqual([]);
    });
  });
  it.each(["executed.json", "responses.json", "commands.json", "runtime-state.json"])(
    "preserves atomic files and does not replay after a failed %s rename",
    async (failFile) => {
      await withTempProject("sample-project", async (dir) => {
        let armed = false;
        let calls = 0;
        const proxy = {
          ...fs,
          renameSync(a: fs.PathLike, b: fs.PathLike) {
            if (
              armed &&
              String(b).endsWith(failFile) &&
              ++calls === (failFile === "executed.json" ? 2 : 1)
            )
              throw new Error("Injected rename failure");
            return fs.renameSync(a, b);
          },
        };
        const r = runtime(dir, { fs: proxy });
        r.start();
        const cmd = r.command(failFile === "runtime-state.json" ? "INSPECT" : "PREVIEW_ITEM", {
          itemId: 1,
        });
        r.write("commands.json", [cmd]);
        armed = true;
        r.tick();
        const shown = r.messages.length;
        r.tick();
        expect(r.messages.length).toBe(shown);
        expect(r.read("commands.json")).toEqual([]);
        expect(r.read("responses.json")).toHaveLength(1);
        expect(
          fs
            .readdirSync(path.join(dir, ".bridge"))
            .some((f) => f.endsWith(".tmp") || f.endsWith(".lock")),
        ).toBe(false);
      });
    },
  );
  it("preserves malformed shared state and reports runtime write failures", async () => {
    await withTempProject("sample-project", async (dir) => {
      const r = runtime(dir);
      r.start();
      for (const [file, data] of [
        ["commands.json", {}],
        ["responses.json", {}],
        ["executed.json", []],
      ]) {
        r.write("commands.json", [r.command("INSPECT")]);
        r.write("responses.json", []);
        r.write("executed.json", {});
        r.write(file as string, data);
        const before = fs.readFileSync(path.join(dir, ".bridge", file as string), "utf8");
        r.tick();
        expect(fs.readFileSync(path.join(dir, ".bridge", file as string), "utf8")).toBe(before);
      }
      writeFileAtomic.sync(path.join(dir, ".bridge/commands.json"), "broken");
      r.tick();
      expect(r.context.console.error).toHaveBeenCalled();
    });
  });
  it.each([
    { channel: "../escape" },
    { channel: "js/plugins" },
    { missingMain: true },
    { missingFs: true },
  ])("fails closed with unavailable/unsafe channel %j", async (options) => {
    await withTempProject("sample-project", async (dir) => {
      const r = runtime(dir, options);
      r.start();
      r.tick();
      r.direct("INSPECT");
      expect(fs.existsSync(path.join(dir, ".bridge/runtime-state.json"))).toBe(false);
    });
  });
  it("handles initialization before game objects exist", async () => {
    await withTempProject("sample-project", async (dir) => {
      const r = runtime(dir, { noGame: true });
      r.start();
      expect(r.read("runtime-state.json").game).toBeNull();
      r.direct("CLEAR_PREVIEW");
    });
  });
});
