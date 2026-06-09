const { app } = require("electron");
const { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const defaults = {
  projectPath: null,
  port: 8866,
  host: "127.0.0.1",
  autoStartServer: true,
  confirmBeforeApply: true,
  windowBounds: { x: undefined, y: undefined, width: 1100, height: 750 },
  lastView: "dashboard",
};

let cachedConfig = null;

function getStorePath() {
  const userDataPath = app.getPath("userData");
  return join(userDataPath, "herolink-config.json");
}

function load() {
  const storePath = getStorePath();
  if (!existsSync(storePath)) {
    cachedConfig = { ...defaults };
    return cachedConfig;
  }
  try {
    const raw = readFileSync(storePath, "utf-8");
    cachedConfig = { ...defaults, ...JSON.parse(raw) };
  } catch {
    cachedConfig = { ...defaults };
  }
  return cachedConfig;
}

function get() {
  if (!cachedConfig) return load();
  return cachedConfig;
}

function set(partial) {
  const current = get();
  Object.assign(current, partial);
  cachedConfig = current;
  const storePath = getStorePath();
  const dir = join(storePath, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  try {
    writeFileSync(storePath, JSON.stringify(current, null, 2), "utf-8");
  } catch { /* best-effort persistence, config cached in memory */ }
}

module.exports = { get, set, load, defaults };
