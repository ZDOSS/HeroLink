const PluginsManager = {
  render() {
    return `
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;">Plugins</h2>

      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;font-size:14px;font-weight:600;">Active Plugins</h3>
          <button class="btn btn-primary btn-sm" onclick="PluginsManager.showAdd()">+ Add Plugin</button>
        </div>
        <div id="pm-plugin-list" style="font-size:12px;color:var(--text-muted);">⏳ Loading...</div>
      </div>
    `;
  },

  attach() {
    this.loadPlugins();
  },

  async loadPlugins() {
    const el = document.getElementById("pm-plugin-list");
    if (!el) return;
    const result = await BridgeAPI.callTool("list_plugins");
    if (!result.success) {
      el.innerHTML = `<span style="color:var(--danger);">${this.escapeHtml(result.error)}</span>`;
      return;
    }
    const plugins = result.data?.plugins || [];
    if (plugins.length === 0) {
      el.innerHTML = '<div style="padding:12px;text-align:center;">No plugins installed.</div>';
      return;
    }
    el.innerHTML = plugins.map((p) => `
      <div class="table-row" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;">${this.escapeHtml(p.name)}</div>
          <div style="font-size:11px;color:var(--text-muted);">${p.status ? "Enabled" : "Disabled"} ${p.description ? "· " + this.escapeHtml(p.description).slice(0, 60) : ""}</div>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="PluginsManager.showEditParams('${this.escapeHtml(p.name)}')">Edit Params</button>
      </div>
    `).join("");
  },

  showEditParams(pluginName) {
    Modal.show({
      title: `Edit Params: ${pluginName}`,
      body: `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div><label>Parameter Key</label><input type="text" id="pm-key" placeholder="Key"></div>
          <div><label>Parameter Value</label><input type="text" id="pm-val" placeholder="Value"></div>
        </div>
      `,
      confirmText: "Save as Draft",
      onConfirm: async () => {
        const key = document.getElementById("pm-key")?.value || "";
        const val = document.getElementById("pm-val")?.value || "";
        if (!key) return;
        const result = await BridgeAPI.callTool("set_plugin_param_draft", { pluginName, params: { [key]: val } });
        if (result.success) {
          await App.refreshPendingCount();
          Modal.show({ title: "Draft Created", body: `<p>Parameter draft for "${this.escapeHtml(pluginName)}" added to Pending Changes.</p>`, confirmText: "OK", cancelText: false });
        } else {
          Modal.show({ title: "Error", body: `<p style="color:var(--danger);">${this.escapeHtml(result.error)}</p>`, confirmText: "OK", cancelText: false });
        }
      },
    });
  },

  showAdd() {
    Modal.show({
      title: "Add Plugin",
      body: `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div><label>Plugin Name</label><input type="text" id="pm-add-name" placeholder="MyPlugin"></div>
          <div><label>Source Path</label><input type="text" id="pm-add-source" placeholder="js/plugins/MyPlugin.js"></div>
        </div>
      `,
      confirmText: "Add as Draft",
      onConfirm: async () => {
        const name = document.getElementById("pm-add-name")?.value || "";
        const source = document.getElementById("pm-add-source")?.value || "";
        if (!name) return;
        const result = await BridgeAPI.callTool("add_plugin_draft", { name, source, params: {} });
        if (result.success) {
          await App.refreshPendingCount();
          Modal.show({ title: "Draft Created", body: `<p>Plugin draft for "${this.escapeHtml(name)}" added to Pending Changes.</p>`, confirmText: "OK", cancelText: false });
        } else {
          Modal.show({ title: "Error", body: `<p style="color:var(--danger);">${this.escapeHtml(result.error)}</p>`, confirmText: "OK", cancelText: false });
        }
      },
    });
  },

  escapeHtml(str) {
    return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
};
