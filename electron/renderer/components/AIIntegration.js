const AIIntegration = {
  render() {
    const config = HeroLinkState.get("config");
    const projectDir = App.escapeHtml(config.projectPath || "/path/to/your/project");

    return `
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;">🧠 AI Integration</h2>

      ${!config.projectPath ? `
        <div class="card" style="margin-bottom:16px;border-left:3px solid var(--warning);">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">⚠️</span>
            <div>
              <strong>No project folder selected yet.</strong>
              <p style="margin:4px 0 0;font-size:12px;color:var(--text-secondary);">Set your project folder in Settings first, then follow the setup guides below.</p>
            </div>
            <button class="btn btn-primary btn-sm" style="margin-left:auto;" onclick="Sidebar.navigate('settings')">Open Settings</button>
          </div>
        </div>
      ` : ""}

      <!-- Section 1: What is this? -->
      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">What is this?</h3>
        <div style="font-size:13px;line-height:1.7;color:var(--text-secondary);">
          <p style="margin:0 0 8px;">HeroLink has <strong>two ways</strong> to be used:</p>
          <ul style="padding-left:20px;margin:0;">
            <li><strong>HTTP API</strong> (port ${config.port || 8866}) — what this GUI uses</li>
            <li><strong>MCP Server</strong> — what AI agents use directly via stdio</li>
          </ul>
          <p style="margin:12px 0 0;">The MCP server gives your AI the exact same 27+ tools (read, draft, validate, apply) so it can safely modify your RPG Maker project — no copy-paste needed.</p>
        </div>
      </div>

      <!-- Section 2: Two ways -->
      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">Two Ways to Connect</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px;">
          <div style="background:var(--bg-primary);padding:12px;border-radius:6px;border:1px solid var(--accent);">
            <strong style="color:var(--accent);">✅ Option A: Auto-Start</strong>
            <p style="margin:4px 0 0;color:var(--text-secondary);">Let your AI client (Claude Desktop, Cursor) start the MCP server automatically when needed. No terminal required.</p>
          </div>
          <div style="background:var(--bg-primary);padding:12px;border-radius:6px;border:1px solid var(--border);">
            <strong>Option B: Manual Start</strong>
            <p style="margin:4px 0 0;color:var(--text-secondary);">Start the MCP server yourself in a terminal. Good for testing and power users.</p>
          </div>
        </div>
      </div>

      <!-- Section 3: Setup Guides -->
      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;">📋 Setup Guides</h3>

        <!-- Claude Desktop -->
        <details style="margin-bottom:8px;" open>
          <summary style="cursor:pointer;font-weight:600;color:var(--accent);font-size:13px;padding:4px 0;">Claude Desktop</summary>
          <div style="margin-top:8px;font-size:12px;line-height:1.7;color:var(--text-secondary);">
            <p style="margin:0 0 8px;">1. Locate your Claude Desktop config file:</p>
            <table style="font-size:11px;margin-bottom:8px;border-collapse:collapse;">
              <tr><td style="padding:2px 8px;color:var(--text-muted);">macOS:</td><td style="padding:2px 8px;"><code>~/Library/Application Support/Claude/claude_desktop_config.json</code></td></tr>
              <tr><td style="padding:2px 8px;color:var(--text-muted);">Windows:</td><td style="padding:2px 8px;"><code>%APPDATA%\\Claude\\claude_desktop_config.json</code></td></tr>
            </table>
            <p style="margin:0 0 8px;">2. Add HeroLink to the <code>mcpServers</code> section:</p>
            <div class="code-block" style="margin-bottom:8px;">
              <button class="copy-btn" onclick="AIIntegration.copyBlock(this)">Copy</button>
              <pre>{
  "mcpServers": {
    "herolink": {
      "command": "npx",
      "args": ["-y", "tsx", "/path/to/HeroLink/src/index.ts"],
      "env": {
        "RPGMV_PROJECT_DIR": "${projectDir.replace(/\\/g, "\\\\")}"
      }
    }
  }
}</pre>
            </div>
            <p>3. Restart Claude Desktop. HeroLink tools will appear in the tools list.</p>
          </div>
        </details>

        <!-- Cursor -->
        <details style="margin-bottom:8px;">
          <summary style="cursor:pointer;font-weight:600;color:var(--accent);font-size:13px;padding:4px 0;">Cursor</summary>
          <div style="margin-top:8px;font-size:12px;line-height:1.7;color:var(--text-secondary);">
            <p style="margin:0 0 8px;">1. Open Cursor Settings → MCP → Add new MCP server</p>
            <p style="margin:0 0 8px;">2. Name: <code>herolink</code></p>
            <p style="margin:0 0 8px;">3. Command:</p>
            <div class="code-block" style="margin-bottom:8px;">
              <button class="copy-btn" onclick="AIIntegration.copyBlock(this)">Copy</button>
              <pre>npx -y tsx /path/to/HeroLink/src/index.ts</pre>
            </div>
            <p>4. Environment: <code>RPGMV_PROJECT_DIR=${projectDir}</code></p>
          </div>
        </details>

        <!-- Other Tools -->
        <details style="margin-bottom:8px;">
          <summary style="cursor:pointer;font-weight:600;color:var(--accent);font-size:13px;padding:4px 0;">Other Tools (VS Code, Continue, Cline, Windsurf)</summary>
          <div style="margin-top:8px;font-size:12px;line-height:1.7;color:var(--text-secondary);">
            <p style="margin:0 0 8px;">Any MCP-compatible tool can connect to HeroLink. The general pattern is:</p>
            <div class="code-block">
              <button class="copy-btn" onclick="AIIntegration.copyBlock(this)">Copy</button>
              <pre>{
  "command": "npx",
  "args": ["-y", "tsx", "path/to/HeroLink/src/index.ts"],
  "env": {
    "RPGMV_PROJECT_DIR": "${projectDir}"
  }
}</pre>
            </div>
          </div>
        </details>

        <!-- Manual -->
        <details style="margin-bottom:8px;">
          <summary style="cursor:pointer;font-weight:600;color:var(--accent);font-size:13px;padding:4px 0;">Manual Start (Terminal)</summary>
          <div style="margin-top:8px;font-size:12px;">
            <div class="code-block">
              <button class="copy-btn" onclick="AIIntegration.copyBlock(this)">Copy</button>
              <pre># PowerShell / CMD
set RPGMV_PROJECT_DIR=${projectDir}
npx tsx src/index.ts

# macOS / Linux / Git Bash
RPGMV_PROJECT_DIR="${projectDir}" npx tsx src/index.ts</pre>
            </div>
          </div>
        </details>
      </div>

      <!-- Section 4: System Prompt -->
      <div class="card" style="margin-bottom:16px;border-left:3px solid var(--accent);">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">💬 Recommended System Prompt</h3>
        <p style="margin:0 0 8px;font-size:12px;color:var(--text-secondary);">Copy this into your AI's custom instructions for the best experience:</p>
        <div class="code-block">
          <button class="copy-btn" onclick="AIIntegration.copyBlock(this)">Copy</button>
          <pre>You are connected to an RPG Maker project via HeroLink.
The project path is: ${projectDir}

Key rules for working with HeroLink:
1. Always use the **draft → review → apply** workflow.
   - Create drafts with create_*_draft tools (no files changed).
   - Review pending changes with list_pending_changes and diff_pending_changes.
   - Apply with apply_patch only when ready.
2. Never apply changes without showing a diff first.
3. Run validate_project_refs before applying to catch issues.
4. Prefer small, safe changes over large batches.
5. Use get_project_status and list_entities to explore the project.
6. Backups are created automatically before every apply.
   Rollback with rollback_last_patch if needed.
7. When editing events, use the constrained command builder.
   The command type must match supported opcode schemas.</pre>
        </div>
      </div>

      <!-- Section 5: Best Practices -->
      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">🛡️ Best Practices & Safety</h3>
        <div style="font-size:12px;line-height:1.7;color:var(--text-secondary);">
          <ul style="padding-left:20px;margin:0;">
            <li>Always review diffs before applying changes</li>
            <li>Watch the <strong>Pending Changes</strong> tab to monitor what your AI drafts</li>
            <li>Backups are created automatically — you can always roll back</li>
            <li>Start with read-only exploration before letting the AI create drafts</li>
            <li>To disconnect, remove HeroLink from your AI client's MCP config</li>
          </ul>
        </div>
      </div>

      <!-- Section 6: Troubleshooting -->
      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">🔧 Troubleshooting</h3>
        <div style="font-size:12px;line-height:1.7;color:var(--text-secondary);">
          <details><summary style="cursor:pointer;font-weight:600;">MCP server not showing up in my AI client</summary>
            <p style="margin:4px 0 0 16px;">Check that the path to <code>src/index.ts</code> is absolute and correct. Restart your AI client after updating the config. Check the client's logs for MCP connection errors.</p></details>
          <details><summary style="cursor:pointer;font-weight:600;">Project directory not being picked up</summary>
            <p style="margin:4px 0 0 16px;">Make sure <code>RPGMV_PROJECT_DIR</code> points to a valid RPG Maker project containing <code>Game.rpgproject</code> (MV) or <code>Game.mzproject</code> (MZ).</p></details>
          <details><summary style="cursor:pointer;font-weight:600;">Permission issues on Windows</summary>
            <p style="margin:4px 0 0 16px;">On Windows, use <code>npx.cmd</code> if <code>npx</code> fails. Make sure Node.js is installed and available in your PATH.</p></details>
          <details><summary style="cursor:pointer;font-weight:600;">Can I run the HTTP server (GUI) and MCP server at the same time?</summary>
            <p style="margin:4px 0 0 16px;">Yes — the HTTP server and MCP server are independent. The GUI uses HTTP, while your AI uses MCP. They can both access the same project simultaneously.</p></details>
        </div>
      </div>

      <!-- Section 7: Advanced -->
      <div class="card">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">⚡ Advanced</h3>
        <div style="font-size:12px;line-height:1.7;color:var(--text-secondary);">
          <details>
            <summary style="cursor:pointer;font-weight:600;">Environment Variables Reference</summary>
            <table style="font-size:11px;border-collapse:collapse;margin-top:4px;">
              <tr><td style="padding:2px 8px;color:var(--accent);font-weight:600;">RPGMV_PROJECT_DIR</td><td style="padding:2px 8px;">Path to your RPG Maker MV/MZ project</td></tr>
              <tr><td style="padding:2px 8px;color:var(--accent);font-weight:600;">HTTP_PORT</td><td style="padding:2px 8px;">HTTP server port (default: 8866)</td></tr>
              <tr><td style="padding:2px 8px;color:var(--accent);font-weight:600;">HTTP_HOST</td><td style="padding:2px 8px;">HTTP server host (default: 127.0.0.1)</td></tr>
            </table>
          </details>
          <details>
            <summary style="cursor:pointer;font-weight:600;margin-top:8px;">Running both servers simultaneously</summary>
            <div class="code-block" style="margin-top:4px;">
              <button class="copy-btn" onclick="AIIntegration.copyBlock(this)">Copy</button>
              <pre># Terminal 1 — HTTP (for Electron GUI)
npx tsx src/http/server.ts

# Terminal 2 — MCP (for AI agent)
npx tsx src/index.ts</pre>
            </div>
          </details>
        </div>
      </div>
    `;
  },

  copyBlock(btn) {
    const pre = btn.nextElementSibling;
    if (pre) {
      navigator.clipboard.writeText(pre.textContent).catch(() => {});
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = "Copy"; }, 2000);
    }
  },
};
