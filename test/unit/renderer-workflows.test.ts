import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderer } from "../helpers/renderer.js";
let r: Awaited<ReturnType<typeof renderer>>;
beforeEach(async () => {
  r = await renderer();
});
afterEach(async () => {
  await r.close();
});
const text = () => r.doc.body.textContent;
const field = (id: string, value: string) => {
  (r.doc.getElementById(id) as any).value = value;
};
const modal = () => r.doc.querySelector('[role="dialog"]');
const review = {
  revision: "a".repeat(64),
  humanSummary: "Review one update",
  validation: { ok: true, issues: [] },
  files: [{ file: "data/Items.json", before: "Old", after: "New" }],
};

describe("desktop renderer workflows", () => {
  it("initializes through preload, renders every view, and exposes keyboard navigation", async () => {
    await r.w.App.init();
    expect(text()).toContain("Welcome to HeroLink");
    expect(r.doc.querySelectorAll("#sidebar button")).toHaveLength(11);
    r.ok("list_project_data", {
      gameTitle: "Game <title>",
      engine: "mz",
      counts: { Item: 2 },
      mapCount: 1,
    });
    await r.w.App.selectProject();
    expect(text()).toContain("Game <title>");
    expect(r.ipc.restartServer).toHaveBeenCalled();
    for (const view of [
      "settings",
      "ai",
      "entities",
      "maps",
      "plugins",
      "backups",
      "pending",
      "docs",
      "tools",
      "logs",
      "dashboard",
      "unknown",
    ]) {
      await r.w.App.renderView(view);
      expect(r.main.textContent?.length).toBeGreaterThan(10);
    }
    r.callbacks.log({ level: "warn", message: "Warning", timestamp: new Date().toISOString() });
    r.callbacks.status({ running: true, port: 8866 });
    expect(r.doc.getElementById("header")?.textContent).toContain("Running");
    r.w.App.navigateTo("settings");
    expect(r.doc.querySelector('[aria-current="page"]')?.textContent).toContain("Settings");
    r.ipc.setConfig.mockRejectedValueOnce(new Error("settings disk full"));
    r.w.Sidebar.navigate("logs");
    await Promise.resolve();
    expect(r.w.HeroLinkState.logs.at(-1).message).toBe("settings disk full");
    const seen = vi.fn();
    const off = r.w.HeroLinkState.on("pendingChangesCount", seen);
    r.w.HeroLinkState.set("pendingChangesCount", 101);
    off();
    r.w.HeroLinkState.set("pendingChangesCount", 102);
    expect(seen).toHaveBeenCalledTimes(1);
    r.w.Sidebar.update();
    expect(text()).toContain("99+");
  });
  it("keeps the last pending count marked stale during outages and retries honestly", async () => {
    r.ok("list_pending_changes", {
      changes: [{ changeId: "x", type: "create", summary: "Draft <item>" }],
    });
    await r.w.App.refreshPendingCount();
    expect(r.w.HeroLinkState.pendingChangesCount).toBe(1);
    r.fail("list_pending_changes");
    await r.w.App.refreshPendingCount();
    await r.w.App.renderView("pending");
    expect(text()).toContain("Could not load pending changes");
    expect(text()).not.toContain("No Pending Changes");
    expect(r.w.HeroLinkState.pendingCountStale).toBe(true);
    expect(r.w.HeroLinkState.pendingChangesCount).toBe(1);
    r.ok("list_pending_changes", { changes: [] });
    await r.w.App.refreshPendingCount();
    await r.w.App.renderView("pending");
    expect(text()).toContain("No Pending Changes");
    expect(r.w.HeroLinkState.pendingCountStale).toBe(false);
  });
  it("preserves modal input after failure, traps/restores focus, and prevents double submit", async () => {
    const origin = r.doc.getElementById("origin")!;
    origin.focus();
    let finish: () => void;
    const pending = new Promise<void>((resolve) => (finish = resolve));
    const handler = vi.fn(() => pending);
    r.w.Modal.show({
      title: '<img onerror="bad">',
      body: '<div><label>Name</label><input id="name" value="kept"></div>',
      confirmText: "Save",
      onConfirm: handler,
    });
    expect(r.doc.activeElement?.id).toBe("name");
    expect(r.doc.querySelector("label")?.htmlFor).toBe("name");
    expect(modal()?.querySelector("img")).toBeNull();
    const buttons = r.doc.querySelectorAll("#modal-root button");
    buttons[buttons.length - 1].focus();
    r.doc.dispatchEvent(new r.w.KeyboardEvent("keydown", { key: "Tab", cancelable: true }));
    expect(r.doc.activeElement?.id).toBe("name");
    r.doc.dispatchEvent(
      new r.w.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true }),
    );
    expect(r.doc.activeElement).toBe(buttons[buttons.length - 1]);
    const first = r.w.Modal.confirm();
    await r.w.Modal.confirm();
    r.w.Modal.close();
    expect(modal()).not.toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
    finish!();
    await first;
    expect(modal()).toBeNull();
    expect(r.doc.activeElement).toBe(origin);
    r.w.Modal.show({
      title: "Failure",
      body: '<input id="name" value="kept">',
      confirmText: "Save",
      onConfirm: () => {
        throw new Error("disk full");
      },
    });
    await r.w.Modal.confirm();
    expect(text()).toContain("disk full");
    expect((r.doc.getElementById("name") as any).value).toBe("kept");
    r.doc.dispatchEvent(new r.w.KeyboardEvent("keydown", { key: "Escape" }));
    expect(modal()).toBeNull();
    const cancelled = vi.fn();
    r.w.Modal.show({ title: "Only content", body: "body", cancelText: false, onCancel: cancelled });
    r.doc.dispatchEvent(new r.w.KeyboardEvent("keydown", { key: "Tab", cancelable: true }));
    r.w.Modal.close();
    expect(cancelled).toHaveBeenCalledOnce();
  });
  it("applies only the reviewed revision and shows validation/conflict errors", async () => {
    r.ok("diff_pending_changes", review);
    r.ok("apply_patch", { transactionId: "t-test" });
    await r.w.PendingChanges.confirmApply();
    expect(text()).toContain("Before");
    expect(text()).toContain("After");
    await r.w.Modal.confirm();
    expect(r.ipc.callTool).toHaveBeenCalledWith("apply_patch", {
      confirm: true,
      expectedRevision: review.revision,
    });
    expect(text()).toContain("Changes applied");
    r.fail("apply_patch", "Reviewed revision changed");
    await r.w.PendingChanges.confirmApply();
    await r.w.Modal.confirm();
    expect(text()).toContain("Reviewed revision changed");
    r.ok("diff_pending_changes", {
      ...review,
      validation: { ok: false, issues: [{ location: "Actor:1", message: "Missing class" }] },
      files: [{ file: "js/plugins/New.js", before: null, after: null }],
    });
    await r.w.PendingChanges.confirmApply();
    expect(text()).toContain("Missing class");
    expect(r.doc.querySelector("[data-confirm]")).toBeNull();
    r.fail("diff_pending_changes");
    await r.w.PendingChanges.confirmApply();
    expect(text()).toContain("Review failed");
    await r.w.PendingChanges.showDiff();
    expect(text()).toContain("Could not load diff");
    r.ok("diff_pending_changes", review);
    await r.w.PendingChanges.showDiff();
    expect(text()).toContain("Full diff");
  });
  it("reports failed discards and refreshes successful discards", async () => {
    r.ok("list_pending_changes", {
      changes: [
        { changeId: "one", type: "update", summary: "Rename <item>" },
        { changeId: "two", type: "addPlugin", summary: "Plugin" },
      ],
    });
    await r.w.App.renderView("pending");
    expect(text()).toContain("Rename <item>");
    r.fail("discard_pending_changes");
    await r.w.PendingChanges.discardOne("one");
    expect(text()).toContain("Discard failed");
    await r.w.PendingChanges.confirmDiscardAll();
    await r.w.Modal.confirm();
    expect(text()).toContain("Service unavailable");
    r.ok("discard_pending_changes", { discarded: 1 });
    await r.w.PendingChanges.discardOne("one");
    expect(r.ipc.callTool).toHaveBeenCalledWith("discard_pending_changes", { changeIds: ["one"] });
    await r.w.PendingChanges.confirmDiscardAll();
    await r.w.Modal.confirm();
    expect(r.ipc.callTool).toHaveBeenCalledWith("discard_pending_changes", {});
  });
  it("paginates entities and drops outdated search responses", async () => {
    await r.w.App.renderView("entities");
    r.ok("list_entities", { items: [{ id: 26, name: "Second page" }], total: 26 });
    r.w.EntityBrowser.offset = 25;
    await r.w.EntityBrowser.refresh();
    expect(text()).toContain("26–26 of 26");
    expect(r.ipc.callTool).toHaveBeenLastCalledWith("list_entities", {
      type: "Item",
      offset: 25,
      limit: 25,
    });
    let complete: (value: any) => void;
    r.replies.set("list_entities", () => new Promise((resolve) => (complete = resolve)));
    const old = r.w.EntityBrowser.refresh();
    r.ok("list_entities", { items: [{ id: 1, name: "Latest search" }], total: 1 });
    await r.w.EntityBrowser.refresh();
    complete!({ ok: true, result: { items: [{ id: 1, name: "Stale search" }], total: 1 } });
    await old;
    expect(text()).toContain("Latest search");
    expect(text()).not.toContain("Stale search");
    r.fail("list_entities");
    await r.w.EntityBrowser.refresh();
    expect(text()).toContain("Service unavailable");
  });
  it("edits only changed fields and preserves invalid form contents", async () => {
    const entity = { id: 5, name: "Old", note: "keep", price: 2, damage: { formula: "a.atk" } };
    r.ok("get_entity", { entity });
    await r.w.EntityBrowser.showEdit("Item", 5);
    await r.w.Modal.confirm();
    expect(r.ipc.callTool.mock.calls.some((c) => c[0] === "update_entity_draft")).toBe(false);
    await r.w.EntityBrowser.showEdit("Item", 5);
    field(
      "eb-edit-fields",
      JSON.stringify({ name: "New", note: "keep", price: 2, damage: entity.damage }),
    );
    await r.w.Modal.confirm();
    expect(r.ipc.callTool).toHaveBeenCalledWith("update_entity_draft", {
      type: "Item",
      id: 5,
      patch: { name: "New" },
    });
    expect(text()).toContain("Draft saved");
    r.fail("update_entity_draft", "Reference missing");
    await r.w.EntityBrowser.showEdit("Item", 5);
    field("eb-edit-fields", '{"price":4}');
    await r.w.Modal.confirm();
    expect(text()).toContain("Reference missing");
    r.fail("get_entity");
    await r.w.EntityBrowser.showEdit("Item", 5);
    expect(text()).toContain("Could not load entity");
    await r.w.EntityBrowser.showDetail("Item", 5);
    expect(text()).toContain("Service unavailable");
    r.ok("get_entity", { entity });
    await r.w.EntityBrowser.showDetail("Item", 5);
    expect(text()).toContain("a.atk");
    expect(text()).toContain("Raw JSON");
  });
  it.each(["Item", "Skill", "Weapon"])(
    "copies a complete %s template into its creation draft",
    async (type) => {
      const entity = { id: 8, name: "Template", note: "fields preserved", price: 42 };
      r.w.EntityBrowser.type = type;
      r.ok("list_entities", { items: [entity], total: 1 });
      await r.w.EntityBrowser.showCreate();
      const template = r.doc.getElementById("eb-template")!;
      template.dispatchEvent(new r.w.Event("change"));
      field("eb-template", "8");
      template.dispatchEvent(new r.w.Event("change"));
      expect(JSON.parse((r.doc.getElementById("eb-create-fields") as any).value)).toEqual({
        name: "Template",
        note: "fields preserved",
        price: 42,
      });
      await r.w.Modal.confirm();
      expect(text()).toContain("Draft created");
      const calls = r.ipc.callTool.mock.calls;
      const created = calls.find((c) => c[0].startsWith("create_"));
      expect(created![1].fields).not.toHaveProperty("id");
      r.fail("list_entities");
      await r.w.EntityBrowser.showCreate();
      expect(text()).toContain("Could not load templates");
    },
  );
  it.each(["CommonEvent", "Troop"])(
    "uses constrained authoring for %s and retains server errors",
    async (type) => {
      r.w.EntityBrowser.type = type;
      await r.w.EntityBrowser.showCreate();
      if (type === "CommonEvent") {
        field("eb-event-name", "Event");
        field("eb-commands", '[{"type":"wait","frames":1}]');
      } else field("eb-create-fields", '{"name":"Troop","members":[],"pages":[]}');
      const name = type === "CommonEvent" ? "create_common_event_draft" : "create_entity_draft";
      r.fail(name);
      await r.w.Modal.confirm();
      expect(text()).toContain("Service unavailable");
      r.ok(name, { changeId: "draft" });
      await r.w.Modal.confirm();
      expect(modal()).toBeNull();
    },
  );
  it("drafts literal plugin source, validates forms, and reports parameter failures", async () => {
    await r.w.App.renderView("plugins");
    r.ok("list_plugins", {
      plugins: [
        { name: "MyPlugin", status: true, description: "Hello" },
        { name: "Disabled", status: false },
      ],
    });
    await r.w.PluginsManager.loadPlugins();
    expect(text()).toContain("Disabled");
    r.w.PluginsManager.showAdd();
    await r.w.Modal.confirm();
    expect(text()).toContain("Enter a plugin name");
    field("pm-add-name", "NewPlugin");
    const source = "/* exact source */\nwindow.Plugin = {};";
    field("pm-add-source", source);
    await r.w.Modal.confirm();
    expect(r.ipc.callTool).toHaveBeenCalledWith("add_plugin_draft", {
      name: "NewPlugin",
      source,
      params: {},
    });
    r.fail("add_plugin_draft");
    r.w.PluginsManager.showAdd();
    field("pm-add-name", "NewPlugin");
    field("pm-add-source", source);
    await r.w.Modal.confirm();
    expect(text()).toContain("Service unavailable");
    r.w.PluginsManager.showEditParams("MyPlugin");
    field("pm-key", "String");
    field("pm-val", "[");
    await r.w.Modal.confirm();
    expect(r.ipc.callTool).toHaveBeenCalledWith("set_plugin_param_draft", {
      pluginName: "MyPlugin",
      params: { String: "[" },
    });
    r.fail("set_plugin_param_draft");
    r.w.PluginsManager.showEditParams("MyPlugin");
    field("pm-key", "String");
    await r.w.Modal.confirm();
    expect(text()).toContain("Service unavailable");
    r.fail("list_plugins");
    await r.w.PluginsManager.loadPlugins();
    expect(text()).toContain("Service unavailable");
  });
  it("shows backups and handles rollback conflicts without claiming success", async () => {
    await r.w.App.renderView("backups");
    r.ok("list_backups", {
      transactions: [{ id: "t-a", timestamp: "2026-09-14", files: ["data/Items.json"] }],
    });
    await r.w.BackupsView.refresh();
    expect(text()).toContain("1 files");
    r.fail("rollback_last_patch", "Editor changes conflict");
    r.w.BackupsView.confirmRollbackLast();
    await r.w.Modal.confirm();
    expect(text()).toContain("Rollback Failed");
    expect(text()).toContain("Editor changes conflict");
    r.ok("rollback_last_patch", { rolledBack: true });
    r.w.BackupsView.confirmRollbackLast();
    await r.w.Modal.confirm();
    expect(text()).toContain("Rollback Complete");
    r.fail("list_backups");
    await r.w.BackupsView.refresh();
    expect(text()).toContain("Service unavailable");
  });
  it("loads maps, event details and search results with explicit errors and emptiness", async () => {
    await r.w.App.renderView("maps");
    r.ok("list_maps", { maps: [{ id: 2, name: "Map <two>" }] });
    await r.w.MapsEvents.loadMaps();
    expect(text()).toContain("Map <two>");
    r.ok("get_map_events", { events: [{ id: 1, name: "NPC", x: 1, y: 2, pageCount: 1 }] });
    await r.w.MapsEvents.selectMap(2);
    expect(text()).toContain("NPC");
    r.w.MapsEvents.showEventDetail(2, 1);
    expect(text()).toContain('"name": "NPC"');
    r.w.MapsEvents.showEventDetail(2, 99);
    expect(text()).toContain("Event not found");
    field("me-search-query", "dialogue");
    r.ok("search_events", { matches: [{ location: "Map:2", snippet: "Some dialogue" }] });
    await r.w.MapsEvents.searchEvents();
    expect(text()).toContain("Some dialogue");
    r.fail("search_events");
    await r.w.MapsEvents.searchEvents();
    expect(text()).toContain("Service unavailable");
    r.ok("search_events", { matches: [] });
    await r.w.MapsEvents.searchEvents();
    expect(text()).toContain("No results");
    r.fail("get_map_events");
    await r.w.MapsEvents.selectMap(2);
    expect(text()).toContain("Service unavailable");
    r.ok("get_map_events", { events: [] });
    await r.w.MapsEvents.selectMap(2);
    expect(text()).toContain("No events on this map");
    r.fail("list_maps");
    await r.w.MapsEvents.loadMaps();
    expect(text()).toContain("Service unavailable");
  });
  it("saves validated settings, restarts and refreshes project data, and reports errors", async () => {
    await r.w.App.renderView("settings");
    field("settings-port", "9000");
    field("settings-project-path", "/project");
    await r.w.ProjectSettings.save();
    expect(r.ipc.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({ port: 9000, projectPath: "/project" }),
    );
    expect(r.ipc.restartServer).toHaveBeenCalled();
    r.ipc.setConfig.mockRejectedValueOnce(new Error("Invalid port"));
    await r.w.ProjectSettings.save();
    expect(text()).toContain("Invalid settings");
    r.ipc.restartServer.mockResolvedValue({ ok: false, error: "Cannot start" });
    await r.w.ProjectSettings.save();
    expect(text()).toContain("Cannot start");
    await r.w.Header.handleRestart();
    expect(text()).toContain("Cannot start");
    r.ipc.startServer.mockResolvedValue({ ok: false, error: "Cannot start" });
    r.w.HeroLinkState.set("serverStatus", { running: false });
    await r.w.Header.handleStartStop();
    expect(text()).toContain("Cannot start");
    r.w.HeroLinkState.set("serverStatus", { running: true });
    await r.w.Header.handleStartStop();
    expect(r.ipc.stopServer).toHaveBeenCalled();
    r.ipc.restartServer.mockResolvedValue({ ok: true });
    await r.w.Header.handleRestart();
    r.ipc.selectProjectFolder.mockResolvedValue(null);
    await r.w.App.selectProject();
    r.ipc.selectProjectFolder.mockResolvedValue("/other");
    r.ipc.restartServer.mockResolvedValue({ ok: false, error: "Other project missing" });
    await r.w.App.selectProject();
    expect(text()).toContain("Other project missing");
  });
  it("renders validation, inspector installation status, and escaped bounded logs", async () => {
    await r.w.App.validateProject();
    expect(text()).toContain("No issues found");
    r.ok("validate_project_refs", { issues: [{ message: "Missing reference" }] });
    await r.w.App.validateProject();
    expect(text()).toContain("Missing reference");
    r.fail("validate_project_refs");
    await r.w.App.validateProject();
    expect(text()).toContain("Validation Error");
    r.w.Modal.close();
    await r.w.App.renderView("docs");
    await r.w.Documentation.installInspector();
    expect(text()).toContain("Installation drafted");
    r.ipc.installInspector.mockResolvedValue({ ok: false, error: "Install failed" });
    await r.w.Documentation.installInspector();
    expect(text()).toContain("Install failed");
    await r.w.App.renderView("logs");
    for (let i = 0; i < 1002; i++)
      r.w.Logs.append({
        level: i % 2 ? "warn" : "info",
        message: "<script>inert</script>",
        timestamp: "2026-09-14T00:00:00Z",
      });
    expect(r.w.HeroLinkState.logs).toHaveLength(1000);
    expect(r.doc.querySelector("script")).toBeNull();
    r.w.Logs.setFilter("warn");
    expect(text()).toContain("500 entries");
    r.w.Logs.append({ level: "info", message: "Hidden" });
    expect(r.doc.getElementById("log-container")?.textContent).not.toContain("Hidden");
    r.w.Logs.copy();
    r.w.Logs.clear();
    expect(text()).toContain("No logs yet");
    const copied = r.doc.createElement("div");
    copied.innerHTML = "<button>Copy</button><pre>example</pre>";
    r.main.append(copied);
    r.w.AIIntegration.copyBlock(copied.firstElementChild);
    expect(copied.firstElementChild?.textContent).toBe("Copied!");
    r.w.Documentation.copyCode(copied.firstElementChild);
  });
});
