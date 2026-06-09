const Sidebar = {
  items: [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "settings", label: "Project Settings", icon: "⚙️" },
    { id: "pending", label: "Pending Changes", icon: "📝", badgeKey: "pendingChangesCount" },
    { id: "docs", label: "Documentation", icon: "📖" },
    { id: "logs", label: "Logs", icon: "📋" },
  ],

  render() {
    const currentView = HeroLinkState.get("currentView");
    const pendingCount = HeroLinkState.get("pendingChangesCount");
    const items = this.items
      .map((item) => {
        const active = item.id === currentView ? "active" : "";
        const badge = item.badgeKey && pendingCount > 0
          ? `<span class="badge badge-danger" style="margin-left:auto;">${pendingCount > 99 ? "99+" : pendingCount}</span>`
          : "";
        return `
          <div class="nav-item ${active}" onclick="Sidebar.navigate('${item.id}')">
            <span style="display:flex;align-items:center;gap:8px;">
              <span>${item.icon}</span>
              <span>${item.label}</span>
              ${badge}
            </span>
          </div>
        `;
      })
      .join("");

    return `
      <div style="display:flex;flex-direction:column;height:100%;">
        ${items}
        <div style="margin-top:auto;padding:12px 16px;font-size:11px;color:var(--text-muted);border-top:1px solid var(--border);">
          v0.1.0 · HTTP ${HeroLinkState.get("config").port || 8866}
        </div>
      </div>
    `;
  },

  navigate(viewId) {
    HeroLinkState.set("currentView", viewId);
    HeroLinkState.set("config", { ...HeroLinkState.get("config"), lastView: viewId });
    window.heroLinkAPI.setConfig({ lastView: viewId });
    App.renderView(viewId);
    this.update();
  },

  update() {
    const el = document.getElementById("sidebar");
    if (el) el.innerHTML = this.render();
  },
};
