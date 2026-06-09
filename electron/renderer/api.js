const BridgeAPI = {
  baseUrl() {
    const config = HeroLinkState.get("config");
    const host = config.host || "127.0.0.1";
    const port = config.port || 8866;
    return `http://${host}:${port}`;
  },

  _clean(obj) {
    const r = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) r[k] = v;
    }
    return r;
  },

  async callTool(toolName, payload = {}) {
    try {
      const res = await fetch(`${this.baseUrl()}/api/tools/${toolName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this._clean(payload)),
      });
      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${text}` };
      }
      const data = await res.json();
      if (data.isError) {
        return { success: false, error: data.content?.[0]?.text || "Unknown error" };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async getProjectStatus() {
    return this.callTool("get_project_status");
  },

  async getPendingChanges() {
    return this.callTool("list_pending_changes");
  },

  async getEntityList(type, query) {
    return this.callTool("list_entities", { type, query: query || undefined });
  },

  async applyPendingChanges() {
    return this.callTool("apply_patch", { confirm: true });
  },

  async discardPendingChanges(changeIds) {
    return this.callTool("discard_pending_changes", changeIds ? { changeIds } : {});
  },

  async getBackups() {
    return this.callTool("list_backups");
  },

  async validateProject() {
    return this.callTool("validate_project_refs");
  },

  async getDiff() {
    return this.callTool("diff_pending_changes");
  },

  async listMaps() {
    return this.callTool("list_maps");
  },

  async listProjectData() {
    return this.callTool("list_project_data");
  },
};
