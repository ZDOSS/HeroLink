const Logs = {
  filter: "all",

  render() {
    const logs = HeroLinkState.get("logs");
    const filtered = this.filter === "all" ? logs : logs.filter((l) => l.level === this.filter);
    const filterLabels = { all: "All", info: "Info", warn: "Warn", error: "Error" };

    const logLines = filtered.length === 0
      ? '<div style="padding:12px;color:var(--text-muted);text-align:center;">No logs yet.</div>'
      : filtered
          .map((l) => {
            const time = l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : "";
            return `<div class="log-entry ${l.level}"><span class="time">[${time}]</span> ${this.escapeHtml(l.message)}</div>`;
          })
          .join("");

    return `
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;">Logs</h2>

      <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;">
        ${Object.entries(filterLabels).map(([key, label]) => `
          <button class="btn btn-sm ${this.filter === key ? "btn-primary" : "btn-ghost"}" onclick="Logs.setFilter('${key}')">${label}</button>
        `).join("")}
        <div style="flex:1;"></div>
        <button class="btn btn-sm btn-ghost" onclick="Logs.clear()">Clear</button>
        <button class="btn btn-sm btn-ghost" onclick="Logs.copy()">Copy</button>
      </div>

      <pre class="log-container" id="log-container">${logLines}</pre>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center;">
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;">
          <input type="checkbox" id="log-autoscroll" checked style="width:auto;"> Auto-scroll
        </label>
        <span style="font-size:11px;color:var(--text-muted);">${filtered.length} entries (${logs.length} total)</span>
      </div>
    `;
  },

  setFilter(key) {
    this.filter = key;
    App.renderView("logs");
  },

  clear() {
    HeroLinkState.set("logs", []);
    App.renderView("logs");
  },

  copy() {
    const logs = HeroLinkState.get("logs");
    const text = logs.map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`).join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  },

  append(entry) {
    const logs = HeroLinkState.get("logs");
    logs.push(entry);
    if (logs.length > 1000) logs.splice(0, logs.length - 1000);
    HeroLinkState.set("logs", logs);
  },

  escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
};
