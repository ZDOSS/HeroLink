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
      const result = await window.heroLinkAPI.callTool(toolName, this._clean(payload));
      return result.ok
        ? { success: true, data: result.result }
        : { success: false, error: result.error || "Tool request failed", code: result.code };
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

  async getEntityList(type, query, offset = 0, limit = 50) {
    return this.callTool("list_entities", { type, query: query || undefined, offset, limit });
  },

  async applyPendingChanges(expectedRevision) {
    return this.callTool("apply_patch", { confirm: true, expectedRevision });
  },

  async discardPendingChanges(changeIds) {
    return this.callTool("discard_pending_changes", changeIds ? { changeIds } : {});
  },

  async getBackups() {
    return this.callTool("list_backups");
  },

  async validateProject() {
    return this.callTool("validate_project_refs", { includePending: true });
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

  async createItem(fields) {
    return this.callTool("create_item_draft", { fields: this._clean(fields) });
  },

  async createSkill(fields) {
    return this.callTool("create_skill_draft", { fields: this._clean(fields) });
  },

  async createEntity(type, fields) {
    return this.callTool("create_entity_draft", { type, fields: this._clean(fields) });
  },

  async getEntity(type, id) {
    return this.callTool("get_entity", { type, id });
  },

  async getMapEvents(mapId) {
    return this.callTool("get_map_events", { mapId });
  },

  async searchEvents(query) {
    return this.callTool("search_events", { query });
  },

  async searchNotes(query) {
    return this.callTool("search_notes", { query });
  },

  async rollbackLast() {
    return this.callTool("rollback_last_patch");
  },

  async listPlugins() {
    return this.callTool("list_plugins");
  },

  async setPluginParamDraft(pluginName, params) {
    return this.callTool("set_plugin_param_draft", { pluginName, params });
  },

  async addPluginDraft(name, source) {
    return this.callTool("add_plugin_draft", { name, source, params: {} });
  },
};
