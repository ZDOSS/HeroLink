const EntityBrowser = {
  type: "Item",
  query: "",
  _searchTimer: null,

  render() {
    const types = ["Item", "Skill", "Weapon", "Armor", "Actor", "Class", "Enemy", "State", "Troop", "CommonEvent"];

    return `
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;">Entity Browser</h2>

      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;gap:8px;align-items:center;">
          <select id="eb-type" onchange="EntityBrowser.type=this.value;EntityBrowser.refresh()" style="width:150px;">
            ${types.map((t) => `<option value="${t}" ${this.type === t ? "selected" : ""}>${t}s</option>`).join("")}
          </select>
          <input type="text" id="eb-query" placeholder="Filter by name..." value="${this.escapeHtml(this.query)}"
            onkeyup="clearTimeout(EntityBrowser._searchTimer);EntityBrowser._searchTimer=setTimeout(()=>{EntityBrowser.query=document.getElementById('eb-query').value;EntityBrowser.refresh()},300)" style="flex:1;">
          <button class="btn btn-primary btn-sm" onclick="EntityBrowser.showCreate()">+ New</button>
        </div>
      </div>

      <div class="card" id="eb-results">
        <div style="padding:12px;text-align:center;color:var(--text-muted);">Select a type to browse.</div>
      </div>
    `;
  },

  attach() {
    this.refresh();
  },

  async refresh() {
    const el = document.getElementById("eb-results");
    if (!el) return;
    el.innerHTML = '<div style="padding:12px;text-align:center;">⏳ Loading...</div>';
    const result = await BridgeAPI.getEntityList(this.type, this.query || undefined);
    if (!result.success) {
      el.innerHTML = `<div style="padding:12px;color:var(--danger);">Error: ${this.escapeHtml(result.error)}</div>`;
      return;
    }
    const items = result.data?.items || [];
    if (items.length === 0) {
      el.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);">No entities found.</div>';
      return;
    }
    el.innerHTML = `
      <div class="table-header" style="display:flex;gap:12px;">
        <span style="width:50px;">ID</span>
        <span style="flex:1;">Name</span>
        <span style="width:80px;text-align:right;">Actions</span>
      </div>
      ${items.map((e) => `
        <div class="table-row" style="display:flex;gap:12px;cursor:pointer;" onclick="EntityBrowser.showDetail('${this.type}',${e.id})">
          <span style="width:50px;color:var(--text-muted);">${e.id}</span>
          <span style="flex:1;">${this.escapeHtml(e.name || "(unnamed)")}</span>
          <span style="width:80px;text-align:right;">
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();EntityBrowser.showEdit('${this.type}',${e.id})">Edit</button>
          </span>
        </div>
      `).join("")}
    `;
  },

  async showDetail(type, id) {
    Modal.show({ title: `${type} #${id}`, body: '<div style="padding:12px;text-align:center;">⏳ Loading...</div>', confirmText: "Close", cancelText: false });
    const result = await BridgeAPI.getEntity(type, id);
    if (!result.success) {
      Modal.show({
        title: `${type} #${id}`,
        body: `<p style="color:var(--danger);">${this.escapeHtml(result.error)}</p>`,
        confirmText: "OK",
        cancelText: false,
      });
      return;
    }
    const entity = result.data?.entity || {};
    const pretty = this.formatEntity(type, entity);
    const raw = JSON.stringify(entity, null, 2);

    Modal.show({
      title: `${type}: ${this.escapeHtml(entity.name || "(unnamed)")}`,
      body: `
        <div style="margin-bottom:8px;display:flex;gap:8px;">
          <button class="btn btn-sm btn-ghost" onclick="document.getElementById('eb-tab-overview').style.display='';document.getElementById('eb-tab-json').style.display='none';">Overview</button>
          <button class="btn btn-sm btn-ghost" onclick="document.getElementById('eb-tab-json').style.display='';document.getElementById('eb-tab-overview').style.display='none';">Raw JSON</button>
        </div>
        <div id="eb-tab-overview" style="font-size:12px;">${pretty}</div>
        <pre id="eb-tab-json" class="code-block" style="display:none;">${this.escapeHtml(raw)}</pre>
      `,
      confirmText: "Close",
      cancelText: false,
    });
  },

  formatEntity(type, e) {
    const rows = [];
    for (const [k, v] of Object.entries(e)) {
      if (k === "id" || k === "note") continue;
      const val = typeof v === "object" ? JSON.stringify(v).slice(0, 80) : String(v ?? "");
      rows.push(`<tr><td style="padding:2px 8px;color:var(--text-muted);font-size:11px;">${this.escapeHtml(k)}</td><td style="padding:2px 8px;">${this.escapeHtml(val)}</td></tr>`);
    }
    return `<table style="width:100%;">${rows.join("")}</table>`;
  },

  showCreate() {
    Modal.show({
      title: `Create ${this.type} Draft`,
      body: `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div><label>Name</label><input type="text" id="eb-cr-name" placeholder="Name"></div>
        </div>
      `,
      confirmText: "Create Draft",
      onConfirm: async () => {
        const fields = { name: document.getElementById("eb-cr-name")?.value || "" };
        const result = await BridgeAPI.createEntity(this.type, fields);
        if (result.success) {
          await App.refreshPendingCount();
          Modal.show({ title: "Draft Created", body: "<p>A new draft has been added to Pending Changes.</p>", confirmText: "OK", cancelText: false });
        } else {
          Modal.show({ title: "Error", body: `<p style="color:var(--danger);">${this.escapeHtml(result.error)}</p>`, confirmText: "OK", cancelText: false });
        }
      },
    });
  },

  showEdit(type, id) {
    Modal.show({ title: `Edit ${type} #${id}`, body: '<p>Update drafts coming in a future release. Use the HTTP API or an AI client for now.</p>', confirmText: "OK", cancelText: false });
  },

  escapeHtml(str) {
    return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  },
};
