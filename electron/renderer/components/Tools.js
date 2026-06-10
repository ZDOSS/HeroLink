const Tools = {
  browserType: "Item",
  browserQuery: "",

  render() {
    return `
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;">Tools</h2>

      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;">Create Draft</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" onclick="Tools.showCreateItem()">+ Item</button>
          <button class="btn btn-primary btn-sm" onclick="Tools.showCreateSkill()">+ Skill</button>
          <button class="btn btn-ghost btn-sm" onclick="Tools.showCreateEntity()">+ Entity</button>
          <button class="btn btn-ghost btn-sm" onclick="Sidebar.navigate('pending')">📝 View Changes</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;">Entity Browser</h3>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <select id="tools-browser-type" onchange="Tools.browserType=this.value;Tools.refreshBrowser()" style="width:140px;">
            <option value="Item" ${this.browserType === "Item" ? "selected" : ""}>Items</option>
            <option value="Skill" ${this.browserType === "Skill" ? "selected" : ""}>Skills</option>
            <option value="Weapon" ${this.browserType === "Weapon" ? "selected" : ""}>Weapons</option>
            <option value="Armor" ${this.browserType === "Armor" ? "selected" : ""}>Armors</option>
            <option value="Actor" ${this.browserType === "Actor" ? "selected" : ""}>Actors</option>
            <option value="Class" ${this.browserType === "Class" ? "selected" : ""}>Classes</option>
            <option value="Enemy" ${this.browserType === "Enemy" ? "selected" : ""}>Enemies</option>
            <option value="State" ${this.browserType === "State" ? "selected" : ""}>States</option>
            <option value="Troop" ${this.browserType === "Troop" ? "selected" : ""}>Troops</option>
          </select>
          <input type="text" id="tools-browser-query" placeholder="Filter by name..." value="${this.escapeHtml(this.browserQuery)}" onkeyup="Tools.browserQuery=this.value;Tools.refreshBrowser()" style="flex:1;">
        </div>
        <div id="tools-browser-results" style="font-size:12px;color:var(--text-muted);">Select a type and click Search to browse entities.</div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;">Quick Actions</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="App.validateProject()">🔍 Validate Project</button>
          <button class="btn btn-ghost btn-sm" onclick="App.refreshDashboard()">🔄 Refresh Data</button>
          <button class="btn btn-ghost btn-sm" onclick="App.selectProject()">📁 Change Project</button>
        </div>
      </div>
    `;
  },

  attach() {
    this.refreshBrowser();
  },

  async refreshBrowser() {
    const el = document.getElementById("tools-browser-results");
    if (!el) return;
    el.innerHTML = '<div style="padding:12px;text-align:center;">⏳ Loading...</div>';
    const result = await BridgeAPI.getEntityList(this.browserType, this.browserQuery || undefined);
    if (!result.success) {
      el.innerHTML = `<div style="padding:12px;color:var(--danger);">Error: ${this.escapeHtml(result.error)}</div>`;
      return;
    }
    const items = result.data?.items || [];
    if (items.length === 0) {
      el.innerHTML = '<div style="padding:12px;text-align:center;">No entities found.</div>';
      return;
    }
    el.innerHTML = items.map((e) => `
      <div class="table-row" style="justify-content:space-between;">
        <span>${this.escapeHtml(e.name || "(unnamed)")}</span>
        <span style="color:var(--text-muted);font-size:11px;">ID ${this.escapeHtml(e.id)}</span>
      </div>
    `).join("");
  },

  showCreateItem() {
    Modal.show({
      title: "Create Item Draft",
      body: `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div><label>Name</label><input type="text" id="cr-item-name" placeholder="Potion"></div>
          <div><label>Description</label><input type="text" id="cr-item-desc" placeholder="Restores HP"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div><label>Item Type</label>
              <select id="cr-item-itype"><option value="1">Regular</option><option value="2">Key Item</option></select></div>
            <div><label>Price</label><input type="number" id="cr-item-price" value="0" min="0"></div>
          </div>
          <div><label>Scope</label>
            <select id="cr-item-scope">
              <option value="0">None</option><option value="1">One Enemy</option><option value="2">All Enemies</option>
              <option value="7">One Ally</option><option value="8">All Allies</option><option value="11">The User</option>
            </select></div>
          <div><label>Animation</label><input type="number" id="cr-item-anim" value="0" min="0"></div>
        </div>
      `,
      confirmText: "Create Draft",
      onConfirm: async () => {
        const fields = {
          name: document.getElementById("cr-item-name")?.value || "",
          description: document.getElementById("cr-item-desc")?.value || "",
          itypeId: parseInt(document.getElementById("cr-item-itype")?.value, 10) || 1,
          price: parseInt(document.getElementById("cr-item-price")?.value, 10) || 0,
          scope: parseInt(document.getElementById("cr-item-scope")?.value, 10) || 0,
          animationId: parseInt(document.getElementById("cr-item-anim")?.value, 10) || 0,
        };
        const result = await BridgeAPI.createItem(fields);
        if (result.success) {
          await App.refreshPendingCount();
        } else {
          Modal.show({ title: "Error", body: `<p style="color:var(--danger);">${this.escapeHtml(result.error)}</p>`, confirmText: "OK" });
        }
      },
    });
  },

  showCreateSkill() {
    Modal.show({
      title: "Create Skill Draft",
      body: `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div><label>Name</label><input type="text" id="cr-skill-name" placeholder="Fireball"></div>
          <div><label>Description</label><input type="text" id="cr-skill-desc" placeholder="A fire spell"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div><label>Skill Type</label><input type="number" id="cr-skill-stype" value="1" min="1"></div>
            <div><label>MP Cost</label><input type="number" id="cr-skill-mp" value="0" min="0"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div><label>Scope</label>
              <select id="cr-skill-scope">
                <option value="1">One Enemy</option><option value="2">All Enemies</option>
                <option value="7">One Ally</option><option value="8">All Allies</option>
              </select></div>
            <div><label>Animation</label><input type="number" id="cr-skill-anim" value="0" min="0"></div>
          </div>
        </div>
      `,
      confirmText: "Create Draft",
      onConfirm: async () => {
        const fields = {
          name: document.getElementById("cr-skill-name")?.value || "",
          description: document.getElementById("cr-skill-desc")?.value || "",
          stypeId: parseInt(document.getElementById("cr-skill-stype")?.value, 10) || 1,
          mpCost: parseInt(document.getElementById("cr-skill-mp")?.value, 10) || 0,
          scope: parseInt(document.getElementById("cr-skill-scope")?.value, 10) || 1,
          animationId: parseInt(document.getElementById("cr-skill-anim")?.value, 10) || 0,
        };
        const result = await BridgeAPI.createSkill(fields);
        if (result.success) {
          await App.refreshPendingCount();
        } else {
          Modal.show({ title: "Error", body: `<p style="color:var(--danger);">${this.escapeHtml(result.error)}</p>`, confirmText: "OK" });
        }
      },
    });
  },

  showCreateEntity() {
    Modal.show({
      title: "Create Entity Draft",
      body: `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div><label>Entity Type</label>
            <select id="cr-entity-type">
              <option value="Weapon">Weapon</option><option value="Armor">Armor</option>
              <option value="Actor">Actor</option><option value="Class">Class</option>
              <option value="Enemy">Enemy</option><option value="State">State</option>
            </select></div>
          <div><label>Name</label><input type="text" id="cr-entity-name" placeholder="Name"></div>
        </div>
      `,
      confirmText: "Create Draft",
      onConfirm: async () => {
        const type = document.getElementById("cr-entity-type")?.value;
        const fields = { name: document.getElementById("cr-entity-name")?.value || "" };
        const result = await BridgeAPI.createEntity(type, fields);
        if (result.success) {
          await App.refreshPendingCount();
        } else {
          Modal.show({ title: "Error", body: `<p style="color:var(--danger);">${this.escapeHtml(result.error)}</p>`, confirmText: "OK" });
        }
      },
    });
  },

  escapeHtml(str) {
    return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
};
