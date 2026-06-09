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
            <span id="project-path-display" title="${this.escapeHtml(config.projectPath || "")}">${config.projectPath || "No project selected"}</span>
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

  handleStartStop() {
    const status = HeroLinkState.get("serverStatus");
    if (status.running) {
      window.heroLinkAPI.stopServer();
    } else {
      window.heroLinkAPI.startServer();
    }
  },

  handleRestart() {
    window.heroLinkAPI.restartServer();
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
