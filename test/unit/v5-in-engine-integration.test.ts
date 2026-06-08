import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadProject } from "../../src/io/project.js";
import { inspectRuntime } from "../../src/tools/inspectRuntime.js";
import { previewEntity } from "../../src/tools/previewEntity.js";
import { withTempProject } from "../helpers/withTempProject.js";

describe("v5 in-engine integration tools", () => {
  describe("inspectRuntime", () => {
    it("returns unavailable if BridgeInspector plugin is not installed", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);

        const result = await inspectRuntime(project, { refresh: false, timeoutMs: 1000 });

        expect(result.available).toBe(false);
        expect(result.state).toBeNull();
        expect(result.error).toContain("BridgeInspector plugin is not installed");
      });
    });

    it("returns unavailable if BridgeInspector plugin is disabled", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);

        // Add BridgeInspector plugin as disabled
        project.model.plugins.push({
          name: "BridgeInspector",
          status: false,
          description: "Test plugin (disabled)",
          parameters: {},
        });

        const result = await inspectRuntime(project, { refresh: false, timeoutMs: 1000 });

        expect(result.available).toBe(false);
        expect(result.state).toBeNull();
        expect(result.error).toContain("disabled");
      });
    });

    it("returns error if plugin is installed but no runtime state exists", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);

        // Add BridgeInspector plugin
        project.model.plugins.push({
          name: "BridgeInspector",
          status: true,
          description: "Test plugin",
          parameters: {},
        });

        const result = await inspectRuntime(project, { refresh: false, timeoutMs: 1000 });

        expect(result.available).toBe(true);
        expect(result.state).toBeNull();
        expect(result.error).toContain("No runtime state available");
      });
    });

    it("reads runtime state when available", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);

        // Add BridgeInspector plugin
        project.model.plugins.push({
          name: "BridgeInspector",
          status: true,
          description: "Test plugin",
          parameters: {},
        });

        // Write mock runtime state
        const bridgeDir = join(projectDir, ".bridge");
        mkdirSync(bridgeDir, { recursive: true });
        const mockState = {
          timestamp: Date.now(),
          game: { title: "Test Game", versionId: 1 },
          party: { members: [], gold: 100 },
          map: { mapId: 1, displayName: "Test Map", playerX: 5, playerY: 5, playerDirection: 2 },
          switches: [true, false, true],
          variables: [10, 20, 30],
        };
        writeFileSync(join(bridgeDir, "runtime-state.json"), JSON.stringify(mockState));

        const result = await inspectRuntime(project, { refresh: false, timeoutMs: 1000 });

        expect(result.available).toBe(true);
        expect(result.state).toEqual(mockState);
        expect(result.error).toBeNull();
      });
    });
  });

  describe("previewEntity", () => {
    it("returns error if BridgeInspector plugin is not installed", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);

        const result = await previewEntity(project, {
          type: "Item",
          id: 1,
          timeoutMs: 1000,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("BridgeInspector plugin is not installed");
      });
    });

    it("returns error if plugin is installed but disabled", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);

        // Add BridgeInspector plugin as disabled
        project.model.plugins.push({
          name: "BridgeInspector",
          status: false,
          description: "Test plugin (disabled)",
          parameters: {},
        });

        const result = await previewEntity(project, {
          type: "Item",
          id: 1,
          timeoutMs: 1000,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("disabled");
      });
    });

    it("returns error if item does not exist", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);

        // Add BridgeInspector plugin
        project.model.plugins.push({
          name: "BridgeInspector",
          status: true,
          description: "Test plugin",
          parameters: {},
        });

        const result = await previewEntity(project, {
          type: "Item",
          id: 9999,
          timeoutMs: 1000,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Item with id 9999 not found");
      });
    });

    it("returns error if skill does not exist", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);

        // Add BridgeInspector plugin
        project.model.plugins.push({
          name: "BridgeInspector",
          status: true,
          description: "Test plugin",
          parameters: {},
        });

        const result = await previewEntity(project, {
          type: "Skill",
          id: 9999,
          timeoutMs: 1000,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Skill with id 9999 not found");
      });
    });

    it("returns entity name for valid item", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);

        // Add BridgeInspector plugin
        project.model.plugins.push({
          name: "BridgeInspector",
          status: true,
          description: "Test plugin",
          parameters: {},
        });

        // Note: This will timeout since no game is running, but we can verify
        // the entity validation works
        const result = await previewEntity(project, {
          type: "Item",
          id: 1,
          timeoutMs: 100, // Short timeout
        });

        // Should fail with timeout, but entity name should be set
        expect(result.entityType).toBe("Item");
        expect(result.entityId).toBe(1);
        expect(result.entityName).toBe("Potion");
      });
    });

    it("returns entity name for valid skill", async () => {
      await withTempProject("sample-project", async (projectDir) => {
        const project = loadProject(projectDir);

        // Add BridgeInspector plugin
        project.model.plugins.push({
          name: "BridgeInspector",
          status: true,
          description: "Test plugin",
          parameters: {},
        });

        // Note: This will timeout since no game is running
        const result = await previewEntity(project, {
          type: "Skill",
          id: 1,
          timeoutMs: 100, // Short timeout
        });

        // Should fail with timeout, but entity name should be set
        expect(result.entityType).toBe("Skill");
        expect(result.entityId).toBe(1);
        expect(result.entityName).toBe("Attack");
      });
    });
  });
});
