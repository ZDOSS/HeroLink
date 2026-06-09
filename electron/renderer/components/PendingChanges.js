const PendingChanges = {
  async render() {
    const result = await BridgeAPI.getPendingChanges();
    const changes = result.success ? (result.data.changes || []) : [];

    if (changes.length === 0) {
      return `
        <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;">Pending Changes</h2>
        <div class="empty-state">
          <div class="icon">✅</div>
          <h3>No Pending Changes</h3>
          <p>Use an AI client or the HTTP API to create drafts. They will appear here for review.</p>
        </div>
      `;
    }

    const rows = changes
      .map((c, i) => {
        const actionLabel = c.type === "create" ? "Create" : c.type === "update" ? "Update" : c.type;
        return `
          <div class="table-row" style="justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span class="badge badge-accent" style="font-size:10px;min-width:16px;height:16px;">${i + 1}</span>
              <div>
                <div style="font-size:13px;">${this.escapeHtml(c.summary)}</div>
                <div style="font-size:11px;color:var(--text-muted);">${actionLabel} · ${c.changeId?.slice(0, 8) || ""}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm btn-ghost" data-change-id="${this.escapeHtml(c.changeId)}" onclick="PendingChanges.discardOne(this.dataset.changeId)">Discard</button>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;">Pending Changes <span class="badge badge-danger">${changes.length}</span></h2>

      <div class="card" style="margin-bottom:16px;">
        <div class="table-header" style="display:flex;justify-content:space-between;">
          <span>Change</span>
          <span>Actions</span>
        </div>
        ${rows}
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-ghost" onclick="PendingChanges.showDiff()">Show Full Diff</button>
        <button class="btn btn-danger" onclick="PendingChanges.confirmDiscardAll()">Discard All</button>
        <button class="btn btn-success" onclick="PendingChanges.confirmApply()">Apply All Changes</button>
      </div>
    `;
  },

  async discardOne(changeId) {
    await BridgeAPI.discardPendingChanges([changeId]);
    await App.refreshPendingCount();
    App.renderView("pending");
  },

  async confirmDiscardAll() {
    Modal.show({
      title: "Discard All Changes",
      body: "Are you sure you want to discard all pending changes? This action cannot be undone.",
      confirmText: "Discard All",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        await BridgeAPI.discardPendingChanges();
        await App.refreshPendingCount();
        App.renderView("pending");
      },
    });
  },

  async confirmApply() {
    const config = HeroLinkState.get("config");
    if (config.confirmBeforeApply) {
      Modal.show({
        title: "Apply All Changes",
        body: `
          <p style="margin:0 0 12px;">This will <strong>permanently modify files</strong> in your RPG Maker project.</p>
          <p style="margin:0 0 12px;">A backup will be created automatically before writing.</p>
          <p style="margin:0;font-size:12px;color:var(--warning);">⚠️ This action cannot be undone via the UI — use rollback from the API if needed.</p>
        `,
        confirmText: "Apply Changes",
        cancelText: "Cancel",
        variant: "success",
        onConfirm: async () => {
          const result = await BridgeAPI.applyPendingChanges();
          if (result.success) {
            await App.refreshPendingCount();
            App.renderView("pending");
            Modal.show({
              title: "Changes Applied",
              body: `<p>Transaction ID: ${this.escapeHtml(String(result.data.transactionId ?? ""))}<br>Files written: ${this.escapeHtml((result.data.filesWritten || []).join(", "))}</p>`,
              confirmText: "OK",
            });
          } else {
            Modal.show({
              title: "Apply Failed",
              body: `<p style="color:var(--danger);">${this.escapeHtml(result.error)}</p>`,
              confirmText: "OK",
            });
          }
        },
      });
    } else {
      const result = await BridgeAPI.applyPendingChanges();
      if (result.success) {
        await App.refreshPendingCount();
      } else {
        Modal.show({ title: "Apply Failed", body: `<p style="color:var(--danger);">${this.escapeHtml(result.error)}</p>`, confirmText: "OK" });
      }
      App.renderView("pending");
    }
  },

  async showDiff() {
    const result = await BridgeAPI.getDiff();
    if (!result.success) {
      Modal.show({ title: "Diff", body: `<p>Could not load diff: ${this.escapeHtml(result.error)}</p>`, confirmText: "OK" });
      return;
    }
    const content = result.data.humanSummary
      ? `<pre class="code-block">${this.escapeHtml(JSON.stringify(result.data, null, 2))}</pre>`
      : "<p>No diff available.</p>";
    Modal.show({ title: "Full Diff", body: content, confirmText: "Close" });
  },

  escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
};
