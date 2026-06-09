const Dashboard = {
  async render() {
    const config = HeroLinkState.get("config");

    if (!config.projectPath) {
      return `
        <div class="empty-state" style="margin-top:48px;">
          <div class="icon">🎮</div>
          <h3>Welcome to HeroLink</h3>
          <p>Select an RPG Maker project folder to get started.<br>The bridge will read your project data and let you safely edit content.</p>
          <button class="btn btn-primary" onclick="App.selectProject()">Select Project Folder</button>
        </div>
      `;
    }

    const status = HeroLinkState.get("serverStatus");
    const summary = HeroLinkState.get("projectSummary");

    let summaryHtml = "";
    if (summary && summary.success) {
      const d = summary.data;
      const entityTypes = d.counts ? Object.entries(d.counts).filter(([k]) => k !== "maps") : [];
      const mapCount = d.mapCount || "?";

      summaryHtml = `
        <div style="margin-bottom:24px;">
          <div class="card" style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:16px;font-weight:600;">${d.gameTitle || "Unknown Project"}</div>
                <div style="font-size:12px;color:var(--text-muted);">
                  Engine: <span class="status-pill status-running" style="font-size:11px;">${d.engine || "mv"}</span>
                </div>
              </div>
              <div style="text-align:right;">
                <div class="status-pill ${status.running ? "status-running" : "status-stopped"}">
                  <span class="dot"></span>
                  Server ${status.running ? "Running" : "Stopped"}
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">http://127.0.0.1:${config.port}</div>
              </div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;">
            ${entityTypes.map(([type, count]) => `
              <div class="card count-card card-hover" onclick="App.navigateTo('entities?type=${type}')" style="cursor:pointer;">
                <div class="count">${count}</div>
                <div class="label">${type}s</div>
              </div>
            `).join("")}
            <div class="card count-card">
              <div class="count">${mapCount}</div>
              <div class="label">Maps</div>
            </div>
          </div>
        </div>
      `;
    }

    const pendingCount = HeroLinkState.get("pendingChangesCount");
    const quickActions = `
      <div style="margin-bottom:24px;">
        <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;">Quick Actions</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="Sidebar.navigate('pending')">
            ${pendingCount > 0 ? `📝 View Pending Changes (${pendingCount})` : "📝 Pending Changes"}
          </button>
          <button class="btn btn-ghost btn-sm" onclick="App.validateProject()">🔍 Validate Project</button>
          <button class="btn btn-ghost btn-sm" onclick="App.refreshDashboard()">🔄 Refresh</button>
        </div>
      </div>
    `;

    return `
      ${summaryHtml || '<div class="card"><p style="color:var(--text-muted);">Connect to server and refresh to see project data.</p></div>'}
      ${quickActions}
    `;
  },
};
