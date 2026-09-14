const PendingChanges = {
  async render() {
    const result = await BridgeAPI.getPendingChanges();
    App.setPendingResult(result);
    if (!result.success)
      return `<h2>Pending Changes</h2><div role="alert" class="card"><p>Could not load pending changes: ${this.escapeHtml(result.error)}</p><button class="btn btn-primary" onclick="App.renderView('pending')">Retry</button></div>`;
    const changes = result.data.changes || [];

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
        const actionLabel =
          c.type === "create" ? "Create" : c.type === "update" ? "Update" : c.type;
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
    const result = await BridgeAPI.discardPendingChanges([changeId]);
    if (!result.success) {
      Modal.show({
        title: "Discard failed",
        body: this.escapeHtml(result.error),
        confirmText: "OK",
        cancelText: false,
      });
      return;
    }
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
        const result = await BridgeAPI.discardPendingChanges();
        if (!result.success) throw new Error(result.error);
        await App.refreshPendingCount();
        App.renderView("pending");
      },
    });
  },

  async confirmApply() {
    const review = await BridgeAPI.getDiff();
    if (!review.success) {
      Modal.show({
        title: "Review failed",
        body: this.escapeHtml(review.error),
        confirmText: "Close",
        cancelText: false,
      });
      return;
    }
    const diff = review.data;
    Modal.show({
      title: "Review changes before applying",
      body: this.reviewHtml(diff),
      confirmText: diff.validation.ok ? "Apply reviewed changes" : false,
      cancelText: "Close",
      onConfirm: async () => {
        const result = await BridgeAPI.applyPendingChanges(diff.revision);
        if (!result.success) throw new Error(result.error);
        await App.refreshProjectSummary();
        await App.refreshPendingCount();
        await App.renderView("pending");
        Modal.show({
          title: "Changes applied",
          body: `<p>Transaction ${this.escapeHtml(result.data.transactionId)}. You can restore it from Backups.</p>`,
          confirmText: "OK",
          cancelText: false,
        });
      },
    });
  },

  formatFile(content, absent) {
    if (content === null) return absent;
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  },
  changedFields(diff, file) {
    const patch = (diff.patches || []).find(
      (p) => p.kind === "jsonPatch" && `data/${p.file}` === file.file,
    );
    if (!patch) return "";
    const before = file.before === null ? null : JSON.parse(file.before);
    const after = file.after === null ? null : JSON.parse(file.after);
    const at = (document, pointer) =>
      pointer
        .slice(1)
        .split("/")
        .map((key) => key.replace(/~1/g, "/").replace(/~0/g, "~"))
        .reduce((value, key) => value?.[key], document);
    const display = (value) =>
      this.escapeHtml(value === undefined ? "(not present)" : JSON.stringify(value, null, 2));
    return `<table class="changed-fields"><caption>Changed fields</caption><thead><tr><th>Path</th><th>Before</th><th>After</th></tr></thead><tbody>${patch.ops.map((op) => `<tr><td>${this.escapeHtml(op.path)}</td><td><pre>${display(at(before, op.path))}</pre></td><td><pre>${display(at(after, op.path))}</pre></td></tr>`).join("")}</tbody></table>`;
  },
  reviewHtml(diff) {
    const issues = diff.validation.issues
      .map(
        (issue) => `<li>${this.escapeHtml(issue.location)}: ${this.escapeHtml(issue.message)}</li>`,
      )
      .join("");
    return (
      `<p>${this.escapeHtml(diff.humanSummary)}</p><p>${diff.validation.ok ? "Validation passed. A backup will be created before writing." : "Resolve the validation errors before applying."}</p>${issues ? `<ul>${issues}</ul>` : ""}` +
      diff.files
        .map(
          (file) =>
            `<details open><summary>${this.escapeHtml(file.file)}</summary>${this.changedFields(diff, file)}<div class="diff-columns"><div><h4>Before</h4><pre class="code-block">${this.escapeHtml(this.formatFile(file.before, "File does not exist"))}</pre></div><div><h4>After</h4><pre class="code-block">${this.escapeHtml(this.formatFile(file.after, "File removed"))}</pre></div></div></details>`,
        )
        .join("")
    );
  },

  async showDiff() {
    const result = await BridgeAPI.getDiff();
    if (!result.success) {
      Modal.show({
        title: "Diff",
        body: `<p>Could not load diff: ${this.escapeHtml(result.error)}</p>`,
        confirmText: "OK",
      });
      return;
    }
    Modal.show({
      title: "Full diff",
      body: this.reviewHtml(result.data),
      confirmText: "Close",
      cancelText: false,
    });
  },

  escapeHtml(str) {
    return App.escapeHtml(str);
  },
};
