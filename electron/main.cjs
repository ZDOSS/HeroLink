const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

let mainWindow = null;
let serverProcess = null;

const isPackaged = app.isPackaged;
const projectRoot = isPackaged ? process.resourcesPath : path.join(__dirname, "..");

function startBridgeServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(projectRoot, "src", "http", "server.ts");

    if (isPackaged) {
      const jsPath = path.join(projectRoot, "dist", "src", "http", "server.js");
      serverProcess = spawn(process.execPath, [jsPath], {
        env: { ...process.env, HTTP_PORT: "8866", HTTP_HOST: "127.0.0.1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } else {
      serverProcess = spawn("npx", ["tsx", serverPath], {
        env: { ...process.env, HTTP_PORT: "8866", HTTP_HOST: "127.0.0.1" },
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      });
    }

    serverProcess.stdout.on("data", (data) => {
      const text = data.toString();
      if (text.includes("HTTP server started")) {
        clearTimeout(startupTimeout);
        resolve();
      }
    });

    serverProcess.on("error", reject);
    serverProcess.on("exit", () => reject(new Error("Server process exited before ready")));

    const startupTimeout = setTimeout(() => resolve(), 10000);
  });
}

app.whenReady().then(async () => {
  try {
    await startBridgeServer();
  } catch {
    // Server failed to start; window will show error state
  }

  mainWindow = new BrowserWindow({
    width: 400,
    height: 200,
    resizable: false,
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
          -webkit-app-region: drag;
        }
        h1 { font-size: 16px; margin: 0 0 8px 0; color: #7c3aed; }
        p { font-size: 12px; margin: 4px 0; color: #a0a0a0; }
        .status { font-size: 11px; }
        .hint { font-size: 10px; color: #666; margin-top: 16px; }
        .close-btn {
          -webkit-app-region: no-drag;
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          color: #666;
          font-size: 16px;
          cursor: pointer;
          padding: 4px 8px;
        }
        .close-btn:hover { color: #f34747; }
      </style>
    </head>
    <body>
      <button class="close-btn" onclick="window.close()">&#10005;</button>
      <h1>RPG Maker Bridge</h1>
      <p class="status" id="status" style="color: #f59e0b">&#9679; Starting server...</p>
      <p>RPGMV_PROJECT_DIR: ${process.env.RPGMV_PROJECT_DIR || "(not set)"}</p>
      <p class="hint" id="hint">Configure AI client to use http://localhost:8866</p>
      <script>
        document.getElementById('status').innerHTML = '● Server running on port 8866';
        document.getElementById('status').style.color = '#22c55e';
      </script>
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
