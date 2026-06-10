const {
  app, BrowserWindow, dialog, ipcMain,
} = require("electron");
const { spawn, execSync } = require("child_process");
const path = require("path");
const { existsSync, mkdirSync, copyFileSync } = require("node:fs");
const store = require("./store.cjs");

let mainWindow = null;
let serverProcess = null;
const pendingLogs = [];
let rendererReady = false;

const isPackaged = app.isPackaged;
const projectRoot = isPackaged ? process.resourcesPath : path.join(__dirname, "..");

function buildServerEnv(projectPath, port, host) {
  const env = { ...process.env };
  if (projectPath) env.RPGMV_PROJECT_DIR = projectPath;
  env.HTTP_PORT = String(port || 8866);
  env.HTTP_HOST = host || "127.0.0.1";
  return env;
}

function startBridgeServer(projectPath, port, host) {
  return new Promise((resolve, reject) => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }

    const serverPath = path.join(projectRoot, "src", "http", "server.ts");
    const env = buildServerEnv(projectPath, port, host);

    let started = false;
    let proc;

    if (isPackaged) {
      const jsPath = path.join(projectRoot, "dist", "src", "http", "server.js");
      proc = spawn(process.execPath, [jsPath], { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
    } else {
      proc = spawn("npx", ["tsx", serverPath], { env, stdio: ["ignore", "pipe", "pipe"], shell: true, detached: true });
    }
    serverProcess = proc;

    proc.stdout.on("data", (data) => {
      const text = data.toString();
      if (!started && text.includes("HTTP server started")) {
        started = true;
        clearTimeout(startupTimeout);
        resolve();
      }
      sendLog("info", text.trim());
    });

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      sendLog("error", text.trim());
    });

    proc.on("error", (err) => {
      sendLog("error", `Server error: ${err.message}`);
      if (!started) {
        clearTimeout(startupTimeout);
        reject(err);
      }
    });

    proc.on("exit", (code) => {
      sendLog("info", `Server process exited (code ${code})`);
      if (serverProcess === proc) {
        serverProcess = null;
        notifyServerStatus(false);
      }
      if (!started) {
        clearTimeout(startupTimeout);
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    const startupTimeout = setTimeout(() => {
      if (!started) {
        sendLog("warn", "Server start timed out — UI will still function");
        started = true;
        resolve();
      }
    }, 15000);
  });
}

function stopBridgeServer() {
  return new Promise((resolve) => {
    if (!serverProcess) { resolve(); return; }
    const proc = serverProcess;
    serverProcess = null;
    const killTimeout = setTimeout(() => {
      if (proc.pid) {
        try {
          if (process.platform === "win32") {
            execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" });
          } else {
            proc.kill("SIGKILL");
          }
        } catch { /* process already gone */ }
      }
      notifyServerStatus(false);
      sendLog("warn", "Server kill timed out — forced");
      resolve();
    }, 3000);
    proc.on("exit", () => {
      clearTimeout(killTimeout);
      notifyServerStatus(false);
      sendLog("info", "Server stopped");
      resolve();
    });
    proc.kill();
  });
}

function sendLog(level, message) {
  const entry = { level, message, timestamp: new Date().toISOString() };
  if (!rendererReady || !mainWindow || mainWindow.isDestroyed()) {
    pendingLogs.push(entry);
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
      store.set({ windowBounds: { x, y, width: w, height: h } });
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
    if (serverProcess) return { ok: true, message: "Server already running" };
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
    return { running: serverProcess !== null, port: store.get().port };
  });

  ipcMain.handle("install-inspector", () => {
    const config = store.get();
    if (!config.projectPath) return { ok: false, error: "No project folder set" };
    const srcFile = path.join(projectRoot, "src", "plugin", "BridgeInspector.js");
    const destDir = path.join(config.projectPath, "js", "plugins");
    const destFile = path.join(destDir, "BridgeInspector.js");
    if (!existsSync(srcFile)) return { ok: false, error: "BridgeInspector.js not found in HeroLink installation" };
    try {
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
      copyFileSync(srcFile, destFile);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

app.whenReady().then(async () => {
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
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", (event) => {
  if (serverProcess) {
    event.preventDefault();
    stopBridgeServer().then(() => process.exit(0));
  }
});
