const EntityBrowser = {
  type: "Item",
  query: "",
  offset: 0,
  pageSize: 25,
  request: 0,
  _searchTimer: null,

  render() {
    const types = [
      "Item",
      "Skill",
      "Weapon",
      "Armor",
      "Actor",
      "Class",
      "Enemy",
      "State",
      "Troop",
      "CommonEvent",
    ];

    return `
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;">Entity Browser</h2>

      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;gap:8px;align-items:center;">
          <select aria-label="Entity type" id="eb-type" onchange="EntityBrowser.type=this.value;EntityBrowser.offset=0;EntityBrowser.refresh()" style="width:150px;">
            ${types.map((t) => `<option value="${t}" ${this.type === t ? "selected" : ""}>${t}s</option>`).join("")}
          </select>
          <input type="text" id="eb-query" aria-label="Filter entities by name" placeholder="Filter by name..." value="${this.escapeHtml(this.query)}"
            onkeyup="clearTimeout(EntityBrowser._searchTimer);EntityBrowser._searchTimer=setTimeout(()=>{EntityBrowser.query=document.getElementById('eb-query').value;EntityBrowser.offset=0;EntityBrowser.refresh()},300)" style="flex:1;">
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
    const request = ++this.request;
    const result = await BridgeAPI.getEntityList(
      this.type,
      this.query || undefined,
      this.offset,
      this.pageSize,
    );
    if (request !== this.request || !el.isConnected) return;
    if (!result.success) {
      el.innerHTML = `<div style="padding:12px;color:var(--danger);">Error: ${this.escapeHtml(result.error)}</div>`;
      return;
    }
    const items = result.data?.items || [];
    if (items.length === 0) {
      el.innerHTML =
        '<div style="padding:12px;text-align:center;color:var(--text-muted);">No entities found.</div>';
      return;
    }
    el.innerHTML = `
      <div class="table-header" style="display:flex;gap:12px;">
        <span style="width:50px;">ID</span>
        <span style="flex:1;">Name</span>
        <span style="width:80px;text-align:right;">Actions</span>
      </div>
      ${items
        .map(
          (e) => `
        <div class="table-row" style="display:flex;gap:12px;cursor:pointer;" onclick="EntityBrowser.showDetail('${this.type}',${e.id})">
          <span style="width:50px;color:var(--text-muted);">${e.id}</span>
          <button class="btn btn-ghost" style="flex:1;text-align:left;" onclick="event.stopPropagation();EntityBrowser.showDetail('${this.type}',${e.id})">${this.escapeHtml(e.name || "(unnamed)")}</button>
          <span style="width:80px;text-align:right;">
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();EntityBrowser.showEdit('${this.type}',${e.id})">Edit</button>
          </span>
        </div>
      `,
        )
        .join("")}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;">
        <button class="btn btn-ghost" ${this.offset === 0 ? "disabled" : ""} onclick="EntityBrowser.offset=Math.max(0,EntityBrowser.offset-EntityBrowser.pageSize);EntityBrowser.refresh()">Previous</button>
        <span>${this.offset + 1}–${Math.min(this.offset + this.pageSize, result.data.total)} of ${result.data.total}</span>
        <button class="btn btn-ghost" ${this.offset + this.pageSize >= result.data.total ? "disabled" : ""} onclick="EntityBrowser.offset+=EntityBrowser.pageSize;EntityBrowser.refresh()">Next</button>
      </div>
    `;
  },

  async showDetail(type, id) {
    Modal.show({
      title: `${type} #${id}`,
      body: '<div style="padding:12px;text-align:center;">⏳ Loading...</div>',
      confirmText: "Close",
      cancelText: false,
    });
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
      title: `${type}: ${entity.name || "(unnamed)"}`,
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
      rows.push(
        `<tr><td style="padding:2px 8px;color:var(--text-muted);font-size:11px;">${this.escapeHtml(k)}</td><td style="padding:2px 8px;">${this.escapeHtml(val)}</td></tr>`,
      );
    }
    return `<table style="width:100%;">${rows.join("")}</table>`;
  },

  async showCreate() {
    const type = this.type;
    if (type === "CommonEvent") {
      Modal.show({
        title: "Create Common Event",
        body: `<label for="eb-event-name">Name</label><input id="eb-event-name"><label for="eb-commands">Commands (constrained command JSON)</label><textarea id="eb-commands" rows="10">[]</textarea><p>Use command names such as showText with a lines array. Raw engine opcodes are rejected.</p>`,
        confirmText: "Create Draft",
        onConfirm: async () => {
          const result = await BridgeAPI.callTool("create_common_event_draft", {
            name: document.getElementById("eb-event-name").value,
            commands: JSON.parse(document.getElementById("eb-commands").value),
          });
          if (!result.success) throw new Error(result.error);
          await App.refreshPendingCount();
        },
      });
      return;
    }
    if (type === "Troop") {
      Modal.show({
        title: "Create Troop",
        body: `<p>Enter name, members, and pages. Each page uses conditions, span, and a constrained commands array.</p><label for="eb-create-fields">Troop fields</label><textarea id="eb-create-fields" rows="12">{}</textarea>`,
        confirmText: "Create Draft",
        onConfirm: async () => {
          const result = await BridgeAPI.createEntity(
            type,
            JSON.parse(document.getElementById("eb-create-fields").value),
          );
          if (!result.success) throw new Error(result.error);
          await App.refreshPendingCount();
        },
      });
      return;
    }
    const result = await BridgeAPI.getEntityList(type, "", 0, 10000);
    if (!result.success) {
      Modal.show({
        title: "Could not load templates",
        body: this.escapeHtml(result.error),
        confirmText: "Close",
        cancelText: false,
      });
      return;
    }
    Modal.show({
      title: `Create ${type} Draft`,
      body: `<p>Select an existing ${type.toLowerCase()} to copy its complete fields, then edit them below. You can also enter all fields directly.</p>
      <label for="eb-template">Template</label><select id="eb-template"><option value="">Choose a template…</option>${result.data.items.map((entity) => `<option value="${entity.id}">${this.escapeHtml(entity.name)} (#${entity.id})</option>`).join("")}</select>
      <label for="eb-create-fields">New entity fields</label><textarea id="eb-create-fields" rows="15" spellcheck="false">{}</textarea>`,
      confirmText: "Create Draft",
      onConfirm: async () => {
        const fields = JSON.parse(document.getElementById("eb-create-fields").value);
        const created =
          type === "Item"
            ? await BridgeAPI.createItem(fields)
            : type === "Skill"
              ? await BridgeAPI.createSkill(fields)
              : await BridgeAPI.createEntity(type, fields);
        if (!created.success) throw new Error(created.error);
        await App.refreshPendingCount();
        Modal.show({
          title: "Draft created",
          body: "<p>Review the complete diff and validation results in Pending Changes.</p>",
          confirmText: "OK",
          cancelText: false,
        });
      },
    });
    document.getElementById("eb-template").addEventListener("change", (event) => {
      const entity = result.data.items.find((item) => item.id === Number(event.target.value));
      if (!entity) return;
      const { id, ...fields } = entity;
      document.getElementById("eb-create-fields").value = JSON.stringify(fields, null, 2);
    });
  },

  async showEdit(type, id) {
    const result = await BridgeAPI.getEntity(type, id);
    if (!result.success) {
      Modal.show({
        title: "Could not load entity",
        body: this.escapeHtml(result.error),
        confirmText: "Close",
        cancelText: false,
      });
      return;
    }
    const { id: entityId, list, pages, ...fields } = result.data.entity;
    Modal.show({
      title: `Edit ${type} #${id}`,
      body: `<p>Changed fields will be staged for review. Event lists use the constrained command tools.</p><label for="eb-edit-fields">Entity fields</label><textarea id="eb-edit-fields" rows="16" spellcheck="false">${this.escapeHtml(JSON.stringify(fields, null, 2))}</textarea>`,
      confirmText: "Save Draft",
      onConfirm: async () => {
        const edited = JSON.parse(document.getElementById("eb-edit-fields").value);
        const patch = Object.fromEntries(
          Object.entries(edited).filter(
            ([key, value]) => JSON.stringify(fields[key]) !== JSON.stringify(value),
          ),
        );
        if (!Object.keys(patch).length) return;
        const saved = await BridgeAPI.callTool("update_entity_draft", { type, id, patch });
        if (!saved.success) throw new Error(saved.error);
        await App.refreshPendingCount();
        Modal.show({
          title: "Draft saved",
          body: "<p>Review your changes in Pending Changes.</p>",
          confirmText: "OK",
          cancelText: false,
        });
      },
    });
  },

  escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },
};
