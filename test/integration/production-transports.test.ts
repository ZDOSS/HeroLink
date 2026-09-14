import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../../src/index.js";
import { createHttpServer } from "../../src/http/server.js";
import { loadProject } from "../../src/io/project.js";
import { TOOL_DEFS } from "../../src/tools/registry.js";
import { withTempProject } from "../helpers/withTempProject.js";

describe.each(["http", "mcp"])("production %s contract", (transport) => {
  it("uses every registered tool and preserves review/apply/rollback across sessions", async () => {
    await withTempProject("sample-project", async (dir) => {
      const project = loadProject(dir);
      const http = createHttpServer(project);
      const server = createMcpServer(project);
      const client = new Client({ name: "audit-regression", version: "1" });
      const [a, b] = InMemoryTransport.createLinkedPair();
      await server.connect(b);
      await client.connect(a);
      const call = async (name: string, args: Record<string, unknown> = {}) => {
        if (transport === "http") {
          const response = await http.inject({
            method: "POST",
            url: `/api/tools/${name}`,
            payload: args,
          });
          const result = response.json();
          if (!result.ok) throw new Error(JSON.stringify(result));
          return result.result;
        }
        const result = await client.callTool({ name, arguments: args });
        const text = result.content[0] as { text: string };
        if (result.isError) throw new Error(text.text);
        return JSON.parse(text.text);
      };
      try {
        expect((await client.listTools()).tools.map((t) => t.name)).toEqual(
          TOOL_DEFS.map((t) => t.name),
        );
        expect((await http.inject({ url: "/api/tools" })).json().tools.map((t) => t.name)).toEqual(
          TOOL_DEFS.map((t) => t.name),
        );
        const item = project.model.listEntities("Item")[0];
        const skill = project.model.listEntities("Skill")[0];
        const actor = project.model.listEntities("Actor")[0];
        const cls = project.model.listEntities("Class")[0];
        const map = project.model.listMapInfos()[0];
        const event = project.model.getMapEvents(map.id)[0];
        const plugin = project.model.plugins[0];
        for (const name of [
          "get_project_status",
          "list_project_data",
          "list_maps",
          "list_plugins",
          "list_pending_changes",
          "list_backups",
          "validate_project_refs",
        ])
          await call(name);
        await call("list_entities", { type: "Item", limit: 1, offset: 1 });
        await call("get_entity", { type: "Item", id: item.id });
        await call("get_map_events", { mapId: map.id });
        await call("search_events", { query: event.name });
        await call("search_notes", { query: "type" });
        expect((await call("inspect_runtime")).available).toBe(false);
        expect((await call("preview_entity", { type: "Item", id: item.id })).success).toBe(false);
        const { id: _item, ...itemFields } = item;
        const { id: _skill, ...skillFields } = skill;
        const { id: _actor, ...actorFields } = actor;
        await call("create_item_draft", { fields: { ...itemFields, name: "Transport item" } });
        await call("create_skill_draft", { fields: { ...skillFields, name: "Transport skill" } });
        await call("create_entity_draft", { type: "Actor", fields: actorFields });
        await call("update_entity_draft", {
          type: "Actor",
          id: actor.id,
          patch: { classId: cls.id, name: "Edited actor" },
        });
        await call("create_common_event_draft", {
          name: "Transport common",
          commands: [{ type: "showText", lines: ["Transport test"] }],
        });
        await call("create_map_event_draft", {
          mapId: map.id,
          name: "Transport event",
          x: event.x,
          y: event.y,
          pages: [{ commands: [{ type: "comment", lines: ["Transport test"] }] }],
        });
        await call("update_map_event_draft", {
          mapId: map.id,
          eventId: event.id,
          pageIndex: 0,
          page: { directionFix: true },
        });
        await call("set_plugin_param_draft", {
          pluginName: plugin.name,
          params: { Audit: "[ unmatched text" },
        });
        await call("add_plugin_draft", { name: "TransportPlugin", source: "/* transport test */" });
        expect((await call("validate_project_refs", { includePending: true })).ok).toBe(true);
        const review = await call("diff_pending_changes");
        expect(new Set(review.patches.map((p: { kind: string }) => p.kind))).toEqual(
          new Set(["jsonPatch", "pluginConfig", "pluginFile"]),
        );
        const second = loadProject(dir);
        second.staging.addUpdate("Item", item.id, { name: "Other session" });
        await expect(
          call("apply_patch", { confirm: true, expectedRevision: review.revision }),
        ).rejects.toThrow(/reviewed revision/);
        const current = await call("diff_pending_changes");
        const applied = await call("apply_patch", {
          confirm: true,
          expectedRevision: current.revision,
        });
        expect((await call("get_project_status")).lastTransactionId).toBe(applied.transactionId);
        expect(
          (await call("list_entities", { type: "Item" })).items.find(
            (i: { name: string }) => i.name === "Transport item",
          ).id,
        ).toBe(Math.max(...project.model.listEntities("Item").map((i) => i.id)));
        await call("rollback_last_patch");
        expect((await call("get_entity", { type: "Item", id: item.id })).entity.name).toBe(
          item.name,
        );
        expect((await call("list_backups")).transactions).toEqual([]);
        await call("create_item_draft", { fields: itemFields });
        const again = await call("diff_pending_changes");
        await call("apply_patch", { confirm: true, expectedRevision: again.revision });
        await call("rollback_last_patch");
        const discard = await call("create_item_draft", { fields: itemFields });
        expect(
          (await call("discard_pending_changes", { changeIds: [discard.changeId] })).remaining,
        ).toBe(0);
        await expect(
          call("create_item_draft", { fields: { name: "Incomplete" } }),
        ).rejects.toThrow();
        await expect(
          call("add_plugin_draft", { name: "../escape", source: "/* rejected */" }),
        ).rejects.toThrow();
        await expect(
          call("update_entity_draft", { type: "Item", id: item.id, patch: { id: item.id + 1 } }),
        ).rejects.toThrow(/immutable/);
        await expect(
          call("get_entity", {
            type: "Item",
            id: Math.max(...project.model.listEntities("Item").map((i) => i.id)) + 100,
          }),
        ).rejects.toThrow();
      } finally {
        await client.close();
        await server.close();
        await http.close();
      }
    });
  });
});

it("protects local HTTP requests from browser origins, rebinding and missing tokens", async () => {
  await withTempProject("sample-project", async (dir) => {
    const server = createHttpServer(loadProject(dir), "test-token");
    try {
      expect((await server.inject({ url: "/health" })).statusCode).toBe(401);
      expect(
        (
          await server.inject({
            url: "/health",
            headers: { authorization: "Bearer test-token", origin: "null" },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await server.inject({
            url: "/health",
            headers: { authorization: "Bearer test-token", host: "attacker.example" },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await server.inject({ url: "/health", headers: { authorization: "Bearer test-token" } })
        ).json().projectDir,
      ).toBe(dir);
    } finally {
      await server.close();
    }
  });
});
