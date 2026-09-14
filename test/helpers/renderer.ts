import { Window } from "happy-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { vi } from "vitest";

export async function renderer() {
  const window = new Window({ url: "http://localhost/" });
  window.document.body.innerHTML =
    '<div id="header"></div><div id="sidebar"></div><main id="main-content"></main><div id="modal-root" class="hidden"></div><button id="origin">Origin</button>';
  await window.happyDOM.whenAsyncComplete();
  let config = {
    projectPath: null,
    port: 8866,
    host: "127.0.0.1",
    autoStartServer: true,
    lastView: "dashboard",
  };
  const callbacks: Record<string, Function> = {};
  const replies = new Map<string, any>();
  const ipc = {
    rendererReady: vi.fn(async () => {}),
    getConfig: vi.fn(async () => ({ ...config })),
    setConfig: vi.fn(async (partial) => {
      config = { ...config, ...partial };
      return config;
    }),
    getServerStatus: vi.fn(async () => ({ running: false, port: 8866 })),
    onServerLog: vi.fn((fn) => (callbacks.log = fn)),
    onServerStatusChanged: vi.fn((fn) => (callbacks.status = fn)),
    selectProjectFolder: vi.fn(async () => "/test/project"),
    restartServer: vi.fn(async () => ({ ok: true })),
    startServer: vi.fn(async () => ({ ok: true })),
    stopServer: vi.fn(async () => ({ ok: true })),
    installInspector: vi.fn(async () => ({ ok: true })),
    callTool: vi.fn(async (name, payload) => {
      const result = replies.get(name);
      if (result instanceof Error) throw result;
      if (typeof result === "function") return result(payload);
      return (
        result ?? {
          ok: true,
          result: {
            changes: [],
            items: [],
            total: 0,
            plugins: [],
            maps: [],
            events: [],
            transactions: [],
            matches: [],
            issues: [],
          },
        }
      );
    }),
  };
  Object.assign(window, { heroLinkAPI: ipc });
  const root = join(process.cwd(), "electron/renderer");
  const html = readFileSync(join(root, "index.html"), "utf8");
  for (const match of html.matchAll(/<script src="([^"]+)"/g)) {
    const file = join(root, match[1]);
    const source = readFileSync(file, "utf8");
    const name = source.match(/^const (\w+) =/m)![1];
    // Evaluate trusted application source, with its real filename for coverage.
    vm.runInContext(source + `\n;globalThis.${name} = ${name};`, window, { filename: file });
  }
  return {
    w: window as any,
    doc: window.document,
    ipc,
    replies,
    callbacks,
    main: window.document.getElementById("main-content")!,
    ok: (name: string, result: any) => replies.set(name, { ok: true, result }),
    fail: (name: string, error = "Service unavailable") => replies.set(name, { ok: false, error }),
    close: () => window.happyDOM.close(),
  };
}
