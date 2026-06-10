const Header = {
  render() {
    const status = HeroLinkState.get("serverStatus");
    const config = HeroLinkState.get("config");
    const statusClass = status.running ? "status-running" : "status-stopped";
    const statusText = status.running ? "Running" : "Stopped";

    return `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-lg font-bold" style="color: var(--accent);">HeroLink</span>
          <span class="text-xs" style="color: var(--text-muted);">Bridge Control Panel</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 text-xs" style="color: var(--text-secondary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <span>📁</span>
            <span id="project-path-display" title="${this.escapeHtml(config.projectPath || "")}">${this.escapeHtml(config.projectPath) || "No project selected"}</span>
          </div>
          <div class="status-pill ${statusClass}" id="status-pill">
            <span class="dot"></span>
            ${statusText}
          </div>
          <button class="btn btn-sm btn-ghost" onclick="Header.handleStartStop()" id="btn-start-stop">${status.running ? "Stop" : "Start"}</button>
          <button class="btn btn-sm btn-ghost" onclick="Header.handleRestart()" id="btn-restart">Restart</button>
        </div>
      </div>
    `;
  },

  async handleStartStop() {
    const status = HeroLinkState.get("serverStatus");
    let result;
    if (status.running) {
      result = await window.heroLinkAPI.stopServer();
    } else {
      result = await window.heroLinkAPI.startServer();
    }
    if (result && !result.ok && result.error) {
      Modal.show({ title: "Server Error", body: `<p style="color:var(--danger);">${this.escapeHtml(result.error)}</p>`, confirmText: "OK" });
    } else if (result && result.ok) {
      await App.refreshProjectSummary();
      if (HeroLinkState.get("currentView") !== "logs") {
        await App.renderView(HeroLinkState.get("currentView"));
      }
    }
  },

  async handleRestart() {
    const result = await window.heroLinkAPI.restartServer();
    if (result && !result.ok && result.error) {
      Modal.show({ title: "Server Error", body: `<p style="color:var(--danger);">${this.escapeHtml(result.error)}</p>`, confirmText: "OK" });
    } else if (result && result.ok) {
      await App.refreshProjectSummary();
      if (HeroLinkState.get("currentView") !== "logs") {
        await App.renderView(HeroLinkState.get("currentView"));
      }
    }
  },

  escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },

  update() {
    const el = document.getElementById("header");
    if (el) el.innerHTML = this.render();
  },
};
