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
          <p>Every change follows a safe <strong>propose → review → apply → rollback</strong> pipeline:</p>
          <ol style="padding-left:20px;">
            <li><strong>Propose:</strong> An AI client creates a draft (item, skill, event, etc.). No files are changed.</li>
            <li><strong>Review:</strong> Pending drafts appear in the Pending Changes view. You can inspect diffs and discard unwanted changes.</li>
            <li><strong>Apply:</strong> When ready, apply all changes. The bridge creates a backup, validates integrity, and writes atomically.</li>
            <li><strong>Rollback:</strong> Use the HTTP API to roll back the last transaction to a previous state.</li>
          </ol>
          <p><strong>Safety guarantees:</strong> Atomic writes (temp + rename), full backups before every apply, staleness detection (refuses if files changed on disk), and byte-identical rollback.</p>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">Available Tools</h3>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.8;">
          <p style="margin:0 0 8px;">The bridge provides these tool categories:</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:4px 8px;font-weight:600;color:var(--accent);">Read</td><td style="padding:4px 8px;">get_project_status, list_entities, get_entity, list_maps, get_map_events, search_events, search_notes, list_plugins</td></tr>
            <tr><td style="padding:4px 8px;font-weight:600;color:var(--accent);">Audit</td><td style="padding:4px 8px;">validate_project_refs</td></tr>
            <tr><td style="padding:4px 8px;font-weight:600;color:var(--accent);">Draft</td><td style="padding:4px 8px;">create_item_draft, create_skill_draft, create_entity_draft, update_entity_draft, create_common_event_draft, create_map_event_draft, set_plugin_param_draft, add_plugin_draft</td></tr>
            <tr><td style="padding:4px 8px;font-weight:600;color:var(--accent);">Apply</td><td style="padding:4px 8px;">apply_patch, rollback_last_patch, discard_pending_changes, list_backups, list_pending_changes, diff_pending_changes</td></tr>
            <tr><td style="padding:4px 8px;font-weight:600;color:var(--accent);">Engine</td><td style="padding:4px 8px;">inspect_runtime, preview_entity <span style="color:var(--warning);font-size:11px;">(requires BridgeInspector plugin)</span></td></tr>
          </table>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;border-left:3px solid var(--warning);">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">🔌 BridgeInspector (Optional)</h3>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.7;">
          <p style="margin:0 0 8px;">Enables <strong>inspect_runtime</strong> and <strong>preview_entity</strong> tools for in-game inspection. Requires the BridgeInspector plugin in your RPG Maker project.</p>
          <p style="margin:0 0 8px;">Install it with one click:</p>
          <button class="btn btn-primary btn-sm" onclick="Documentation.installInspector()" id="btn-install-inspector">Install BridgeInspector to Project</button>
          <span id="install-inspector-status" style="margin-left:8px;font-size:11px;"></span>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">API Usage</h3>

        <p style="font-size:12px;color:var(--text-secondary);margin:0 0 8px;"><strong>HTTP</strong> (port ${HeroLinkState.get("config").port || 8866})</p>
        <div class="code-block">
          <button class="copy-btn" onclick="Documentation.copyCode(this)">Copy</button>
          <pre># Get project status
curl http://127.0.0.1:${HeroLinkState.get("config").port || 8866}/api/tools/get_project_status

# Create an item draft
curl -X POST http://127.0.0.1:${HeroLinkState.get("config").port || 8866}/api/tools/create_item_draft \
  -H "Content-Type: application/json" \
  -d '{"fields": {"name": "Hi-Potion", "itypeId": 1}}'

# View pending changes
curl http://127.0.0.1:${HeroLinkState.get("config").port || 8866}/api/tools/list_pending_changes

# Apply changes
curl -X POST http://127.0.0.1:${HeroLinkState.get("config").port || 8866}/api/tools/apply_patch \
  -H "Content-Type: application/json" -d '{"confirm": true}'</pre>
        </div>

        <p style="font-size:12px;color:var(--text-secondary);margin:12px 0 8px;"><strong>MCP</strong> (for AI clients like Claude Code, Cursor)</p>
        <div class="code-block">
          <button class="copy-btn" onclick="Documentation.copyCode(this)">Copy</button>
          <pre>RPGMV_PROJECT_DIR=path/to/project npx tsx src/index.ts</pre>
        </div>

        <p style="font-size:12px;color:var(--text-secondary);margin:12px 0 8px;"><strong>CLI</strong></p>
        <div class="code-block">
          <button class="copy-btn" onclick="Documentation.copyCode(this)">Copy</button>
          <pre>npx tsx src/cli.ts status path/to/project
npx tsx src/cli.ts validate path/to/project
npx tsx src/cli.ts pending path/to/project
npx tsx src/cli.ts apply path/to/project
npx tsx src/cli.ts rollback path/to/project</pre>
        </div>
      </div>

      <div class="card">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">Resources</h3>
        <div style="font-size:13px;line-height:1.8;color:var(--text-secondary);">
          <p style="margin:0;"><a href="https://github.com/ZDOSS/HeroLink" target="_blank" style="color:var(--accent);">View full README on GitHub</a> — includes version history, project structure, and all CLI commands.</p>
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

  async installInspector() {
    const statusEl = document.getElementById("install-inspector-status");
    const btn = document.getElementById("btn-install-inspector");
    if (btn) btn.disabled = true;
    if (statusEl) statusEl.textContent = "Installing...";

    const result = await window.heroLinkAPI.installInspector();

    if (result.ok) {
      if (statusEl) {
        statusEl.textContent = "Installed to js/plugins/BridgeInspector.js";
        statusEl.style.color = "var(--success)";
      }
    } else {
      if (statusEl) {
        statusEl.textContent = result.error || "Install failed";
        statusEl.style.color = "var(--danger)";
      }
      if (btn) btn.disabled = false;
    }
  },
};
