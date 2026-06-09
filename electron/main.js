const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const { createServer } = require("http");

let mainWindow = null;
let serverProcess = null;

// Determine if we're running from source or packaged
const isPackaged = app.isPackaged;
const projectRoot = isPackaged ? process.resourcesPath : path.join(__dirname, "..");

function startBridgeServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(projectRoot, "src", "http", "server.ts");

    if (isPackaged) {
      // In packaged mode, use the compiled JS
      const jsPath = path.join(projectRoot, "dist", "src", "http", "server.js");
      serverProcess = spawn(process.execPath, [jsPath], {
        env: { ...process.env, HTTP_PORT: "8866", HTTP_HOST: "127.0.0.1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } else {
      // In dev mode, use tsx
      serverProcess = spawn("npx", ["tsx", serverPath], {
        env: { ...process.env, HTTP_PORT: "8866", HTTP_HOST: "127.0.0.1" },
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      });
    }

    serverProcess.stdout.on("data", (data) => {
      const text = data.toString();
      if (text.includes("HTTP server started")) {
        resolve();
      }
    });

    serverProcess.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    serverProcess.on("error", reject);

    // Timeout after 10 seconds
    setTimeout(() => resolve(), 10000);
  });
}

app.whenReady().then(async () => {
  await startBridgeServer();

  mainWindow = new BrowserWindow({
    width: 400,
    height: 200,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false },
  });

  mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #1a1a2e;
          color: #e0e0e0;
          margin: 0;
          padding: 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: center;
          height: 100vh;
        }
        h1 { font-size: 16px; margin: 0 0 8px 0; color: #7c3aed; }
        p { font-size: 12px; margin: 4px 0; color: #a0a0a0; }
        .status { color: #22c55e; font-size: 11px; }
        .hint { font-size: 10px; color: #666; margin-top: 16px; }
      </style>
    </head>
    <body>
      <h1>RPG Maker Bridge</h1>
      <p class="status">● Server running on port 8866</p>
      <p>RPGMV_PROJECT_DIR: ${process.env.RPGMV_PROJECT_DIR || "(not set)"}</p>
      <p class="hint">Configure your AI client to use http://localhost:8866</p>
    </body>
    </html>
  `));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
