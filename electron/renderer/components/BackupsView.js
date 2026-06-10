const BackupsView = {
  render() {
    return `
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;">Backups & History</h2>

      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;font-size:14px;font-weight:600;">Transaction History</h3>
          <button class="btn btn-primary btn-sm" onclick="BackupsView.refresh()">🔄 Refresh</button>
        </div>
        <div id="bv-backup-list" style="font-size:12px;color:var(--text-muted);">⏳ Loading...</div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">Quick Actions</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-danger btn-sm" onclick="BackupsView.confirmRollbackLast()">↩ Rollback Last Transaction</button>
          <button class="btn btn-ghost btn-sm" onclick="BackupsView.refresh()">Refresh</button>
        </div>
      </div>
    `;
  },

  attach() {
    this.refresh();
    document.getElementById("bv-backup-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".bv-detail-btn");
      if (btn) this.showDetail(btn.dataset.txnId);
    });
  },

  async refresh() {
    const el = document.getElementById("bv-backup-list");
    if (!el) return;
    el.innerHTML = '<div style="padding:12px;text-align:center;">⏳ Loading...</div>';
    const result = await BridgeAPI.getBackups();
    if (!result.success) {
      el.innerHTML = `<span style="color:var(--danger);">${this.escapeHtml(result.error)}</span>`;
      return;
    }
    const transactions = result.data?.transactions || [];
    if (transactions.length === 0) {
      el.innerHTML = '<div style="padding:12px;text-align:center;">No transactions recorded yet.</div>';
      return;
    }
    el.innerHTML = transactions.map((t, i) => `
      <div class="table-row" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;">${i + 1}. ${this.escapeHtml(t.id?.slice(0, 12) || "?")}</div>
          <div style="font-size:11px;color:var(--text-muted);">${this.escapeHtml(t.timestamp || "")} · ${(t.files || []).length} files</div>
        </div>
        <button class="btn btn-sm btn-ghost bv-detail-btn" data-txn-id="${this.escapeHtml(t.id)}">Details</button>
      </div>
    `).join("");
  },

  showDetail(id) {
    Modal.show({
      title: "Transaction Detail",
      body: "Use the HTTP API to inspect backup contents or restore individual files.",
      confirmText: "OK",
      cancelText: false,
    });
  },

  confirmRollbackLast() {
    Modal.show({
      title: "Rollback Last Transaction",
      body: "This will restore your project files to the state before the last apply. A backup of the current state will be created before rollback.",
      confirmText: "Rollback",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        const result = await BridgeAPI.rollbackLast();
        if (result.success) {
          Modal.show({ title: "Rollback Complete", body: "<p>Last transaction has been rolled back.</p>", confirmText: "OK", cancelText: false });
          BackupsView.refresh();
        } else {
          Modal.show({ title: "Rollback Failed", body: `<p style="color:var(--danger);">${this.escapeHtml(result.error)}</p>`, confirmText: "OK", cancelText: false });
        }
      },
    });
  },

  escapeHtml(str) {
    return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  },
};
