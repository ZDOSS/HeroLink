const MapsEvents = {
  _selectedMapId: null,
  _events: null,

  render() {
    return `
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;">Maps & Events</h2>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <div class="card" style="margin-bottom:12px;">
            <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">Maps</h3>
            <div id="me-map-list" style="font-size:12px;color:var(--text-muted);">⏳ Loading...</div>
          </div>
        </div>
        <div>
          <div class="card">
            <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">Events</h3>
            <div id="me-event-list" style="font-size:12px;color:var(--text-muted);">Select a map to view its events.</div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px;">
        <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;">Search Events</h3>
        <div style="display:flex;gap:8px;">
          <input type="text" id="me-search-query" placeholder="Search event text..." style="flex:1;" onkeyup="if(event.key==='Enter')MapsEvents.searchEvents()">
          <button class="btn btn-primary btn-sm" onclick="MapsEvents.searchEvents()">Search</button>
        </div>
        <div id="me-search-results" style="margin-top:12px;font-size:12px;"></div>
      </div>
    `;
  },

  attach() {
    this.loadMaps();
  },

  async loadMaps() {
    const el = document.getElementById("me-map-list");
    if (!el) return;
    const result = await BridgeAPI.listMaps();
    if (!result.success) {
      el.innerHTML = `<span style="color:var(--danger);">${this.escapeHtml(result.error)}</span>`;
      return;
    }
    const maps = result.data?.maps || [];
    if (maps.length === 0) {
      el.innerHTML = "No maps found.";
      return;
    }
    el.innerHTML = maps.map((m, i) => `
      <div class="table-row ${this._selectedMapId === m.id ? "" : ""}"
           style="cursor:pointer;display:flex;justify-content:space-between;${this._selectedMapId === m.id ? "background:var(--accent-light);" : ""}"
           onclick="MapsEvents.selectMap(${m.id})">
        <span>${this.escapeHtml(m.name)}</span>
        <span style="color:var(--text-muted);font-size:11px;">ID ${m.id}</span>
      </div>
    `).join("");
  },

  async selectMap(mapId) {
    this._selectedMapId = mapId;
    this.loadMaps();
    const el = document.getElementById("me-event-list");
    if (!el) return;
    el.innerHTML = '<div style="padding:12px;text-align:center;">⏳ Loading...</div>';
    const result = await BridgeAPI.getMapEvents(mapId);
    if (!result.success) {
      el.innerHTML = `<span style="color:var(--danger);">${this.escapeHtml(result.error)}</span>`;
      return;
    }
    const events = result.data?.events || [];
    this._events = events;
    if (events.length === 0) {
      el.innerHTML = "No events on this map.";
      return;
    }
    el.innerHTML = events.map((e) => `
      <div class="table-row" style="cursor:pointer;display:flex;justify-content:space-between;"
           onclick="MapsEvents.showEventDetail(${mapId},${e.id})">
        <div>
          <div style="font-size:13px;">${this.escapeHtml(e.name || "(unnamed)")}</div>
          <div style="font-size:11px;color:var(--text-muted);">ID ${e.id} ${e.x !== undefined ? "· (" + e.x + "," + e.y + ")" : ""}</div>
        </div>
        <span style="font-size:11px;color:var(--text-muted);">${e.pageCount || "?"} pages</span>
      </div>
    `).join("");
  },

  showEventDetail(mapId, eventId) {
    const event = (this._events || []).find((ev) => ev.id === eventId);
    Modal.show({
      title: `Event: ${this.escapeHtml(event?.name || "(unnamed)")}`,
      body: event
        ? `<pre class="code-block" style="max-height:400px;overflow-y:auto;">${this.escapeHtml(JSON.stringify(event, null, 2))}</pre>`
        : "<p>Event not found.</p>",
      confirmText: "Close",
      cancelText: false,
    });
  },

  async searchEvents() {
    const query = document.getElementById("me-search-query")?.value || "";
    const el = document.getElementById("me-search-results");
    if (!el || !query) return;
    el.innerHTML = '<div style="padding:12px;text-align:center;">⏳ Searching...</div>';
    const result = await BridgeAPI.searchEvents(query);
    if (!result.success) {
      el.innerHTML = `<span style="color:var(--danger);">${this.escapeHtml(result.error)}</span>`;
      return;
    }
    const matches = result.data?.matches || [];
    if (matches.length === 0) {
      el.innerHTML = '<div style="padding:12px;color:var(--text-muted);text-align:center;">No results.</div>';
      return;
    }
    el.innerHTML = matches.map((m) => `
      <div class="table-row">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:2px;">${this.escapeHtml(m.location)}</div>
        <div style="font-size:12px;">${this.escapeHtml(m.snippet)}</div>
      </div>
    `).join("");
  },

  escapeHtml(str) {
    return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  },
};
