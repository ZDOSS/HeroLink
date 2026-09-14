import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import writeFileAtomic from "write-file-atomic";
import { BridgeProcess } from "../../electron/server.mjs";
import { createStore } from "../../electron/store.mjs";

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  roots.splice(0).forEach((p) => rmSync(p, { force: true, recursive: true }));
});
const directory = () => {
  const p = realpathSync(mkdtempSync(join(tmpdir(), "herolink-desktop-unit-")));
  roots.push(p);
  return p;
};
function server(options: object = {}) {
  const root = directory();
  const proc = Object.assign(new EventEmitter(), {
    pid: 13579,
    exitCode: null,
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
  });
  const fetchRequest = vi.fn(async () => ({
    ok: true,
    json: async () => ({ ok: true, projectDir: root, pid: proc.pid }),
  }));
  const spawnProcess = vi.fn(() => proc);
  const kill = vi.fn();
  const status = vi.fn();
  const log = vi.fn();
  const bridge = new BridgeProcess({
    root,
    fetchRequest,
    spawnProcess,
    kill,
    status,
    log,
    startupMs: 100,
    ...options,
  });
  return {
    root,
    proc,
    fetchRequest,
    spawnProcess,
    kill,
    status,
    log,
    bridge,
    config: { projectPath: root, port: 18866, host: "127.0.0.1" },
  };
}

describe("desktop settings persistence", () => {
  it("validates every setting and persists atomically across instances", () => {
    const file = join(directory(), "settings/config.json");
    const a = createStore(file);
    expect(a.get().projectPath).toBeNull();
    a.set({ port: 12345, windowBounds: { x: 5, y: 6, width: 900, height: 650 } });
    expect(createStore(file).get().port).toBe(12345);
    const snapshot = a.get();
    snapshot.port = 1;
    expect(a.get().port).toBe(12345);
    for (const input of [
      { port: 0 },
      { host: "0.0.0.0" },
      { lastView: "bogus" },
      { windowBounds: { width: 100 } },
      { unexpected: true },
    ])
      expect(() => a.set(input)).toThrow();
    expect(JSON.parse(readFileSync(file, "utf8")).windowBounds.width).toBe(900);
  });
  it("retains old cached and persisted settings after a failed atomic write", () => {
    const file = join(directory(), "config.json");
    const store = createStore(file);
    store.set({ port: 1234 });
    vi.spyOn(writeFileAtomic, "sync").mockImplementationOnce(() => {
      throw new Error("disk full");
    });
    expect(() => store.set({ port: 4321 })).toThrow("disk full");
    expect(store.get().port).toBe(1234);
    expect(createStore(file).get().port).toBe(1234);
    writeFileAtomic.sync(file, "bad JSON");
    expect(() => createStore(file).get()).toThrow();
  });
});

describe("desktop bridge lifecycle", () => {
  it.each([false, true])("authenticates readiness and requests; packaged=%s", async (packaged) => {
    const s = server({ packaged });
    await s.bridge.start(s.config);
    expect(s.bridge.ready).toBe(true);
    const [command, args, options] = s.spawnProcess.mock.calls[0];
    expect(args.join(" ")).toContain(packaged ? "dist/http/server.js" : "src/http/server.ts");
    expect(options.env.HEROLINK_TOKEN).toMatch(/^[a-f0-9]{64}$/);
    expect(s.fetchRequest.mock.calls[0][1].headers.Authorization).toBe(
      `Bearer ${options.env.HEROLINK_TOKEN}`,
    );
    s.proc.stderr.emit(
      "data",
      Buffer.from(
        '{"level":30,"msg":"ready"}\n{"level":40,"msg":"warning"}\n{"level":50,"msg":"failure"}\nplain text',
      ),
    );
    s.proc.stdout.emit("data", Buffer.from("info"));
    expect(s.log.mock.calls).toContainEqual(["info", "ready"]);
    expect(s.log.mock.calls).toContainEqual(["warn", "warning"]);
    expect(s.log.mock.calls).toContainEqual(["error", "failure"]);
    s.fetchRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { total: 2 } }),
    });
    expect(await s.bridge.callTool("list_entities", { type: "Item" })).toEqual({
      ok: true,
      result: { total: 2 },
    });
    const request = s.fetchRequest.mock.calls.at(-1);
    expect(request[1].method).toBe("POST");
    expect(JSON.parse(request[1].body)).toEqual({ type: "Item" });
    await expect(s.bridge.callTool("../health", {})).rejects.toThrow("Invalid tool");
    await expect(s.bridge.callTool("get_entity", [])).rejects.toThrow("Invalid tool");
    s.fetchRequest.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ ok: false, code: "ConflictError", error: "stale" }),
    });
    expect((await s.bridge.callTool("apply_patch")).code).toBe("ConflictError");
    s.fetchRequest.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ message: "Bad gateway" }),
    });
    await expect(s.bridge.callTool("list_entities")).rejects.toThrow("HTTP 502");
    await s.bridge.stop();
    expect(s.kill.mock.calls).toEqual([
      [-s.proc.pid, "SIGTERM"],
      [-s.proc.pid, "SIGKILL"],
    ]);
    await expect(s.bridge.callTool("list_entities")).rejects.toThrow("not ready");
    await s.bridge.stop();
    expect(s.kill).toHaveBeenCalledTimes(2);
  });
  it.each(["wrong project", "unauthorized", "unreachable", "exited", "spawn error"])(
    "fails readiness on %s and cleans up",
    async (condition) => {
      const s = server({ startupMs: 10 });
      s.fetchRequest.mockImplementation(async () => {
        if (condition === "exited") s.proc.emit("exit", 1);
        if (condition === "spawn error") s.proc.emit("error", new Error("cannot spawn"));
        if (condition === "unreachable") throw new Error("refused");
        return {
          ok: condition !== "unauthorized",
          json: async () => ({ ok: true, projectDir: "/wrong", pid: 1 }),
        };
      });
      await expect(s.bridge.start(s.config)).rejects.toThrow();
      expect(s.bridge.ready).toBe(false);
      expect(s.bridge.process).toBeNull();
    },
  );
  it("serializes simultaneous restarts and rotates the launch token", async () => {
    const s = server();
    await s.bridge.start(s.config);
    const oldToken = s.bridge.token;
    await Promise.all([s.bridge.start(s.config), s.bridge.start(s.config)]);
    expect(s.spawnProcess).toHaveBeenCalledTimes(3);
    expect(s.bridge.token).not.toBe(oldToken);
    expect(s.bridge.ready).toBe(true);
    s.proc.emit("exit", 0);
    expect(s.bridge.ready).toBe(false);
  });
  it("uses IPv6 brackets and kills the Windows process tree before discarding its PID", async () => {
    const exec = vi.fn((_cmd, _args, _options, done) => done(null));
    const s = server({ platform: "win32", exec });
    await s.bridge.start({ ...s.config, host: "::1" });
    expect(s.fetchRequest.mock.calls[0][0]).toContain("http://[::1]:");
    expect(s.spawnProcess.mock.calls[0][2].shell).toBe(true);
    await s.bridge.stop();
    expect(exec.mock.calls[0].slice(0, 2)).toEqual([
      "taskkill",
      ["/F", "/T", "/PID", String(s.proc.pid)],
    ]);
    expect(s.kill).not.toHaveBeenCalled();
  });
  it("refuses Windows shell metacharacters and surfaces failed process cleanup", async () => {
    const s = server({
      platform: "win32",
      exec: (_a, _b, _c, done) => done(new Error("taskkill failed")),
    });
    await s.bridge.start(s.config);
    await expect(s.bridge.stop()).rejects.toThrow("taskkill failed");
    s.bridge.root += "%injection%";
    await expect(s.bridge.start(s.config)).rejects.toThrow("shell characters");
    const p = server({
      kill: () => {
        throw Object.assign(new Error("denied"), { code: "EPERM" });
      },
    });
    await p.bridge.start(p.config);
    await expect(p.bridge.stop()).rejects.toThrow("denied");
    const gone = server({
      kill: () => {
        throw Object.assign(new Error("gone"), { code: "ESRCH" });
      },
    });
    await gone.bridge.start(gone.config);
    await gone.bridge.stop();
    expect(gone.bridge.ready).toBe(false);
  });
});
