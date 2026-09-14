import { spawn, execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { realpathSync } from "node:fs";
import { join } from "node:path";

export class BridgeProcess {
  constructor({
    root,
    packaged = false,
    log = () => {},
    status = () => {},
    spawnProcess = spawn,
    fetchRequest = fetch,
    platform = process.platform,
    kill = process.kill.bind(process),
    exec = execFile,
    startupMs = 15000,
  }) {
    Object.assign(this, {
      root,
      packaged,
      log,
      status,
      spawnProcess,
      fetchRequest,
      platform,
      kill,
      exec,
      startupMs,
    });
    this.process = null;
    this.ready = false;
    this.queue = Promise.resolve();
  }
  serialize(work) {
    const result = this.queue.then(work, work);
    this.queue = result.catch(() => {});
    return result;
  }
  start(config) {
    return this.serialize(async () => {
      await this.stopNow();
      await this.startNow(config);
    });
  }
  stop() {
    return this.serialize(() => this.stopNow());
  }
  async startNow(config) {
    const projectDir = realpathSync(config.projectPath);
    const host = config.host === "::1" ? "[::1]" : config.host;
    this.baseUrl = `http://${host}:${config.port}`;
    this.token = randomBytes(32).toString("hex");
    const env = {
      ...process.env,
      RPGMV_PROJECT_DIR: projectDir,
      HTTP_PORT: String(config.port),
      HTTP_HOST: config.host,
      HEROLINK_TOKEN: this.token,
      ELECTRON_RUN_AS_NODE: "1",
    };
    const options = { env, stdio: ["ignore", "pipe", "pipe"], detached: true, cwd: this.root };
    const file = join(this.root, this.packaged ? "dist/http/server.js" : "src/http/server.ts");
    // Keep shell:true for Windows npx compatibility, and quote the installation
    // path as shell syntax. Refuse unsupported Windows shell metacharacters.
    if (this.platform === "win32" && /[%!\r\n"&|<>^]/.test(file))
      throw new Error("Unsupported shell characters in installation path");
    const quoted =
      this.platform === "win32" ? `"${file}"` : "'" + file.replace(/'/g, "'\"'\"'") + "'";
    const proc = this.packaged
      ? this.spawnProcess(process.execPath, [file], options)
      : this.spawnProcess("npx", ["tsx", quoted], { ...options, shell: true });
    this.process = proc;
    let failure;
    proc.on("error", (error) => {
      failure = error;
    });
    proc.on("exit", (code) => {
      failure = new Error(`Server exited with code ${code}`);
      if (this.process === proc) {
        this.process = null;
        this.ready = false;
        this.status(false);
      }
    });
    proc.stdout?.on("data", (data) => this.log("info", data.toString().trim()));
    proc.stderr?.on("data", (data) => {
      for (const line of data.toString().trim().split("\n")) {
        try {
          const record = JSON.parse(line);
          this.log(
            record.level >= 50 ? "error" : record.level >= 40 ? "warn" : "info",
            record.msg ?? line,
          );
        } catch {
          this.log("info", line);
        }
      }
    });
    const deadline = Date.now() + this.startupMs;
    try {
      while (Date.now() < deadline) {
        if (failure) throw failure;
        try {
          const response = await this.fetchRequest(`${this.baseUrl}/health`, {
            headers: { Authorization: `Bearer ${this.token}` },
            signal: AbortSignal.timeout(Math.min(500, this.startupMs)),
          });
          const health = response.ok ? await response.json() : null;
          if (health?.ok && health.projectDir === projectDir && Number.isInteger(health.pid)) {
            this.ready = true;
            this.status(true);
            return;
          }
        } catch {
          /* health endpoint may not be listening yet */
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error("Server readiness timed out");
    } catch (error) {
      await this.stopNow();
      throw error;
    }
  }
  async callTool(name, payload = {}) {
    if (!this.ready || !this.process) throw new Error("Server is not ready. Start it in Settings.");
    if (
      !/^[a-z_]+$/.test(name) ||
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    )
      throw new Error("Invalid tool request");
    const response = await this.fetchRequest(`${this.baseUrl}/api/tools/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.token}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(65000),
    });
    const result = await response.json();
    if (!response.ok && result.ok !== false) throw new Error(`HTTP ${response.status}`);
    return result;
  }
  async stopNow() {
    const proc = this.process;
    this.process = null;
    this.ready = false;
    this.status(false);
    if (!proc?.pid) return;
    if (this.platform === "win32") {
      // Kill the tree while its shell PID still exists; killing only the shell
      // first makes a later taskkill /T unable to find descendants.
      await new Promise((resolve, reject) =>
        this.exec(
          "taskkill",
          ["/F", "/T", "/PID", String(proc.pid)],
          { windowsHide: true },
          (error) => (error && proc.exitCode === null ? reject(error) : resolve()),
        ),
      );
      return;
    }
    try {
      this.kill(-proc.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    // Signal the group even when the shell has exited; a descendant can survive.
    try {
      this.kill(-proc.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}
