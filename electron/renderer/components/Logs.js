const Logs = {
  filter: "all",

  render() {
    const logs = HeroLinkState.get("logs");
    const filtered = this.filter === "all" ? logs : logs.filter((l) => l.level === this.filter);
    const filterLabels = { all: "All", info: "Info", warn: "Warn", error: "Error" };

    return `
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;">Logs</h2>

      <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;">
        ${Object.entries(filterLabels).map(([key, label]) => `
          <button class="btn btn-sm log-filter-btn ${this.filter === key ? "btn-primary" : "btn-ghost"}" data-filter="${key}" onclick="Logs.setFilter('${key}')">${label}</button>
        `).join("")}
        <div style="flex:1;"></div>
        <button class="btn btn-sm btn-ghost" onclick="Logs.clear()">Clear</button>
        <button class="btn btn-sm btn-ghost" onclick="Logs.copy()">Copy</button>
      </div>

      <pre class="log-container" id="log-container"></pre>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center;">
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;">
          <input type="checkbox" id="log-autoscroll" checked style="width:auto;"> Auto-scroll
        </label>
        <span style="font-size:11px;color:var(--text-muted);" id="log-counter">${filtered.length} entries (${logs.length} total)</span>
      </div>
    `;
  },

  _populateContainer() {
    const container = document.getElementById("log-container");
    if (!container) return;
    const logs = HeroLinkState.get("logs");
    const filtered = this.filter === "all" ? logs : logs.filter((l) => l.level === this.filter);
    container.innerHTML = filtered.length === 0
      ? '<div style="padding:12px;color:var(--text-muted);text-align:center;">No logs yet.</div>'
      : filtered.map((l) => {
          const time = l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : "";
          return `<div class="log-entry ${l.level}"><span class="time">[${time}]</span> ${this.escapeHtml(l.message)}</div>`;
        }).join("");
    this._scrollToBottom();
  },

  _scrollToBottom() {
    const container = document.getElementById("log-container");
    const checkbox = document.getElementById("log-autoscroll");
    if (container && checkbox && checkbox.checked) {
      container.scrollTop = container.scrollHeight;
    }
  },

  _updateCounter() {
    const el = document.getElementById("log-counter");
    if (!el) return;
    const logs = HeroLinkState.get("logs");
    const filtered = this.filter === "all" ? logs : logs.filter((l) => l.level === this.filter);
    el.textContent = `${filtered.length} entries (${logs.length} total)`;
  },

  setFilter(key) {
    this.filter = key;
    document.querySelectorAll(".log-filter-btn").forEach((btn) => {
      btn.className = `btn btn-sm log-filter-btn ${btn.dataset.filter === key ? "btn-primary" : "btn-ghost"}`;
    });
    this._populateContainer();
    this._updateCounter();
  },

  clear() {
    HeroLinkState.set("logs", []);
    this._populateContainer();
    this._updateCounter();
  },

  copy() {
    const logs = HeroLinkState.get("logs");
    const text = logs.map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`).join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  },

  append(entry) {
    const logs = HeroLinkState.get("logs");
    const matchesFilter = this.filter === "all" || entry.level === this.filter;
    logs.push(entry);
    if (logs.length > 1000) logs.splice(0, logs.length - 1000);
    HeroLinkState.set("logs", logs);

    const container = document.getElementById("log-container");
    if (container && matchesFilter) {
      const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "";
      const div = document.createElement("div");
      div.className = `log-entry ${entry.level}`;
      div.innerHTML = `<span class="time">[${time}]</span> ${this.escapeHtml(entry.message)}`;
      container.appendChild(div);
      this._scrollToBottom();
    }
    this._updateCounter();
  },

  attach() {
    this._populateContainer();
  },

  escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
};
