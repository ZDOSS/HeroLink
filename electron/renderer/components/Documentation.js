const Documentation = {
  render() {
    return `
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;">Documentation</h2>

      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">Quick Start</h3>
        <ol style="margin:0;padding-left:20px;font-size:13px;line-height:1.8;color:var(--text-secondary);">
          <li>Set your project folder in <strong>Project Settings</strong>.</li>
          <li>Start the server (or enable auto-start).</li>
          <li>Use an AI client (Claude Code, Cursor, etc.) to interact with the bridge.</li>
          <li>Create drafts via the AI client, then review them in <strong>Pending Changes</strong>.</li>
          <li>Apply changes — backups are created automatically.</li>
        </ol>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">The Draft & Apply Workflow</h3>
        <div style="font-size:13px;line-height:1.6;color:var(--text-secondary);">
          <p>HeroLink uses a safe <strong>propose → review → apply</strong> workflow:</p>
          <ol style="padding-left:20px;">
            <li><strong>Propose:</strong> The AI client creates a draft (item, skill, event, etc.). No files are changed.</li>
            <li><strong>Review:</strong> Pending drafts appear in the Pending Changes view. You can inspect them and see diffs.</li>
            <li><strong>Apply:</strong> When ready, apply all changes. The bridge creates a backup, validates integrity, and writes atomically.</li>
            <li><strong>Rollback:</strong> Use the API to roll back the last transaction to a previous state.</li>
          </ol>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">API Usage (HTTP)</h3>
        <p style="font-size:12px;color:var(--text-secondary);margin:0 0 12px;">
          The bridge exposes an HTTP API at <code>http://127.0.0.1:${HeroLinkState.get("config").port || 8866}</code>.
          All tools are available via <code>POST /api/tools/:toolName</code>.
        </p>
        <div class="code-block">
          <button class="copy-btn" onclick="Documentation.copyCode(this)">Copy</button>
          <pre># Get project status
curl http://127.0.0.1:${HeroLinkState.get("config").port || 8866}/api/tools/get_project_status

# Create an item draft
curl -X POST http://127.0.0.1:${HeroLinkState.get("config").port || 8866}/api/tools/create_item_draft \
  -H "Content-Type: application/json" \
  -d '{"fields": {"name": "Hi-Potion", "itypeId": 1, "price": 300}}'

# View pending changes
curl http://127.0.0.1:${HeroLinkState.get("config").port || 8866}/api/tools/list_pending_changes

# Apply changes
curl -X POST http://127.0.0.1:${HeroLinkState.get("config").port || 8866}/api/tools/apply_patch \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'</pre>
        </div>
      </div>

      <div class="card">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">Available Tools</h3>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.8;">
          <p>The bridge provides tools for reading, auditing, drafting, and managing your project:</p>
          <ul style="padding-left:20px;">
            <li><strong>Read:</strong> get_project_status, list_entities, get_entity, list_maps, search_events, search_notes</li>
            <li><strong>Audit:</strong> validate_project_refs</li>
            <li><strong>Draft:</strong> create_item_draft, create_skill_draft, create_entity_draft, update_entity_draft, create_common_event_draft, create_map_event_draft, set_plugin_param_draft, add_plugin_draft</li>
            <li><strong>Apply:</strong> apply_patch, rollback_last_patch, discard_pending_changes, list_backups</li>
          </ul>
        </div>
      </div>
    `;
  },

  copyCode(btn) {
    const pre = btn.nextElementSibling;
    if (pre) {
      navigator.clipboard.writeText(pre.textContent).catch(() => {});
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = "Copy"; }, 2000);
    }
  },
};
