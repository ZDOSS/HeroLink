const ProjectSettings = {
  render() {
    const config = HeroLinkState.get("config");

    return `
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;">Project Settings</h2>

      <div class="card" style="margin-bottom:16px;">
        <div style="margin-bottom:16px;">
          <label>Project Folder</label>
          <div style="display:flex;gap:8px;">
            <input type="text" id="settings-project-path" value="${this.escapeHtml(config.projectPath || "")}" placeholder="Select an RPG Maker project folder..." readonly style="flex:1;cursor:pointer;" onclick="App.selectProject()">
            <button class="btn btn-primary" onclick="App.selectProject()">Browse</button>
          </div>
          ${config.projectPath ? `<div style="margin-top:4px;font-size:11px;color:var(--text-muted);">Detected: <span class="status-pill status-running" style="font-size:10px;">MV</span></div>` : ""}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div>
            <label>HTTP Port</label>
            <input type="number" id="settings-port" value="${config.port}" min="1024" max="65535">
          </div>
          <div>
            <label>Host</label>
            <input type="text" id="settings-host" value="${config.host}">
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="settings-autostart" ${config.autoStartServer ? "checked" : ""} style="width:auto;">
            Auto-start server on launch
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="settings-confirm" ${config.confirmBeforeApply ? "checked" : ""} style="width:auto;">
            Require confirmation before apply
          </label>
        </div>

        <button class="btn btn-primary" onclick="ProjectSettings.save()">Save & Restart Server</button>
      </div>

      <div class="card" style="font-size:12px;color:var(--text-muted);">
        <strong>Configuration file:</strong> Stored in your app data directory.<br>
        Changing project folder will automatically restart the server with the new path.
      </div>
    `;
  },

  async save() {
    const projectPath = document.getElementById("settings-project-path").value || null;
    const port = parseInt(document.getElementById("settings-port").value, 10) || 8866;
    const host = document.getElementById("settings-host").value || "127.0.0.1";
    const autoStartServer = document.getElementById("settings-autostart").checked;
    const confirmBeforeApply = document.getElementById("settings-confirm").checked;

    await window.heroLinkAPI.setConfig({ projectPath, port, host, autoStartServer, confirmBeforeApply });
    HeroLinkState.set("config", await window.heroLinkAPI.getConfig());

    const result = await window.heroLinkAPI.restartServer();
    if (result.ok) {
      HeroLinkState.set("serverStatus", { ...HeroLinkState.get("serverStatus"), running: true });
    }
    App.updateHeader();
    App.updateSidebar();
    App.renderView("settings");
  },

  escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
};
