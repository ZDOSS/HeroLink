import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createStore } from "./store.mjs";
import { BridgeProcess } from "./server.mjs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = createStore(path.join(app.getPath("userData"), "herolink-config.json"));
let mainWindow = null;
const pendingLogs = [];
let rendererReady = false;

const isPackaged = app.isPackaged;
const projectRoot = isPackaged ? process.resourcesPath : path.join(__dirname, "..");

const bridge = new BridgeProcess({
  root: projectRoot,
  packaged: isPackaged,
  log: sendLog,
  status: notifyServerStatus,
});
const startBridgeServer = (projectPath, port, host) => bridge.start({ projectPath, port, host });
const stopBridgeServer = () => bridge.stop();
function sendLog(level, message) {
  const entry = { level, message, timestamp: new Date().toISOString() };
  if (!rendererReady || !mainWindow || mainWindow.isDestroyed()) {
    pendingLogs.push(entry);
    if (pendingLogs.length > 1000) pendingLogs.shift();
    return;
  }
  mainWindow.webContents.send("server-log", entry);
}

function notifyServerStatus(running) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const config = store.get();
    mainWindow.webContents.send("server-status-changed", { running, port: config.port });
  }
}

let saveBoundsTimer = null;

function saveBoundsDebounced() {
  clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const [w, h] = mainWindow.getSize();
      const [x, y] = mainWindow.getPosition();
      try {
        store.set({ windowBounds: { x, y, width: w, height: h } });
      } catch (error) {
        sendLog("error", error.message);
      }
    }
  }, 400);
}

function createWindow() {
  const config = store.get();
  const bounds = config.windowBounds || { width: 1100, height: 750 };

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 650,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.on("resize", saveBoundsDebounced);
  mainWindow.on("move", saveBoundsDebounced);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  ipcMain.handle("renderer-ready", () => {
    rendererReady = true;
    pendingLogs.splice(0).forEach((e) => mainWindow?.webContents.send("server-log", e));
  });

  ipcMain.handle("select-project-folder", async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Select RPG Maker Project Folder",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("get-config", () => {
    return store.get();
  });

  ipcMain.handle("set-config", (_event, partial) => {
    store.set(partial);
    return store.get();
  });

  ipcMain.handle("start-server", async () => {
    const config = store.get();
    if (!config.projectPath) return { ok: false, error: "No project folder set" };
    if (bridge.ready) return { ok: true, message: "Server already running" };
    try {
      await startBridgeServer(config.projectPath, config.port, config.host);
      notifyServerStatus(true);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("stop-server", async () => {
    await stopBridgeServer();
    return { ok: true };
  });

  ipcMain.handle("restart-server", async () => {
    const config = store.get();
    await stopBridgeServer();
    if (!config.projectPath) return { ok: false, error: "No project folder set" };
    try {
      await startBridgeServer(config.projectPath, config.port, config.host);
      notifyServerStatus(true);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("get-server-status", () => {
    return { running: bridge.ready, port: store.get().port };
  });

  ipcMain.handle("call-tool", async (_event, name, payload) => bridge.callTool(name, payload));
  ipcMain.handle("install-inspector", async () => {
    try {
      const source = readFileSync(path.join(projectRoot, "src/plugin/BridgeInspector.js"), "utf8");
      return await bridge.callTool("add_plugin_draft", {
        name: "BridgeInspector",
        source,
        status: true,
        params: {},
      });
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
}

app
  .whenReady()
  .then(async () => {
    registerIpcHandlers();
    createWindow();

    const config = store.get();
    if (config.autoStartServer && config.projectPath && existsSync(config.projectPath)) {
      sendLog("info", "Auto-starting server...");
      try {
        await startBridgeServer(config.projectPath, config.port, config.host);
        notifyServerStatus(true);
      } catch {
        sendLog("error", "Server auto-start failed — configure project in Settings");
      }
    }
  })
  .catch((error) => {
    dialog.showErrorBox("HeroLink could not start", error.message);
    app.quit();
  });

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", (event) => {
  if (bridge.process) {
    event.preventDefault();
    stopBridgeServer()
      .then(() => app.quit())
      .catch((error) => {
        sendLog("error", error.message);
        app.exit(1);
      });
  }
});
