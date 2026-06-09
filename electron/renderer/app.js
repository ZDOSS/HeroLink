const App = {
  escapeHtml(str) {
    return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  },

  async init() {
    await window.heroLinkAPI.rendererReady();
    const config = await window.heroLinkAPI.getConfig();
    HeroLinkState.set("config", config);
    HeroLinkState.set("currentView", config.lastView || "dashboard");

    const status = await window.heroLinkAPI.getServerStatus();
    HeroLinkState.set("serverStatus", status);

    window.heroLinkAPI.onServerLog((entry) => {
      Logs.append(entry);
    });

    window.heroLinkAPI.onServerStatusChanged((status) => {
      HeroLinkState.set("serverStatus", status);
      App.updateHeader();
    });

    App.updateHeader();
    App.updateSidebar();
    await App.refreshProjectSummary();
    await App.refreshPendingCount();
    await App.renderView(HeroLinkState.get("currentView"));
  },

  updateHeader() {
    Header.update();
  },

  updateSidebar() {
    Sidebar.update();
  },

  async renderView(viewId) {
    const main = document.getElementById("main-content");
    if (!main) return;

    HeroLinkState.set("currentView", viewId);

    const loading = '<div class="empty-state"><div class="icon">⏳</div><h3>Loading...</h3></div>';

    switch (viewId) {
      case "dashboard":
        main.innerHTML = loading;
        main.innerHTML = await Dashboard.render();
        break;
      case "settings":
        main.innerHTML = ProjectSettings.render();
        break;
      case "pending":
        main.innerHTML = loading;
        main.innerHTML = await PendingChanges.render();
        break;
      case "docs":
        main.innerHTML = Documentation.render();
        break;
      case "logs":
        main.innerHTML = Logs.render();
        Logs.attach();
        break;
      default:
        main.innerHTML = loading;
        main.innerHTML = await Dashboard.render();
    }

    App.updateSidebar();
  },

  async refreshProjectSummary() {
    const result = await BridgeAPI.listProjectData();
    HeroLinkState.set("projectSummary", result);
  },

  async refreshPendingCount() {
    const result = await BridgeAPI.getPendingChanges();
    const count = result.success ? (result.data.changes || []).length : 0;
    HeroLinkState.set("pendingChangesCount", count);
    App.updateSidebar();
  },

  async selectProject() {
    const folder = await window.heroLinkAPI.selectProjectFolder();
    if (!folder) return;
    await window.heroLinkAPI.setConfig({ projectPath: folder });
    HeroLinkState.set("config", await window.heroLinkAPI.getConfig());
    App.updateHeader();
    await App.renderView(HeroLinkState.get("currentView"));
    await App.refreshProjectSummary();
    const result = await window.heroLinkAPI.restartServer();
    if (result.ok) {
      HeroLinkState.set("serverStatus", { ...HeroLinkState.get("serverStatus"), running: true });
      App.updateHeader();
    } else if (result && result.error) {
      Modal.show({ title: "Server Error", body: `<p style="color:var(--danger);">${this.escapeHtml(result.error)}</p>`, confirmText: "OK" });
    }
  },

  async validateProject() {
    const result = await BridgeAPI.validateProject();
    if (result.success) {
      const issues = result.data.issues || [];
      Modal.show({
        title: "Validation Results",
        body: issues.length === 0
          ? "<p style='color:var(--success);'>✅ No issues found. Project is clean.</p>"
          : `<pre style="max-height:400px;overflow-y:auto;font-size:12px;">${this.escapeHtml(JSON.stringify(issues, null, 2))}</pre>`,
        confirmText: "OK",
      });
    } else {
      Modal.show({
        title: "Validation Error",
        body: `<p style="color:var(--danger);">${this.escapeHtml(result.error)}</p>`,
        confirmText: "OK",
      });
    }
  },

  async refreshDashboard() {
    await App.refreshProjectSummary();
    await App.refreshPendingCount();
    await App.renderView("dashboard");
  },

  navigateTo(view) {
    Sidebar.navigate(view);
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
