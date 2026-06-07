import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { withTempProject } from "../helpers/withTempProject.js";
import { loadProject } from "../../src/io/project.js";
import { applyPatch } from "../../src/mutate/apply.js";
import { rollbackLastPatch } from "../../src/mutate/rollback.js";
import { hashFile } from "../../src/model/hash.js";
import { StaleProjectError } from "../../src/errors.js";
import { Backup } from "../../src/mutate/backup.js";

describe("mutation safety", () => {
  it("apply → rollback restores byte-identical files", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      const itemsPath = join(projectDir, "data", "Items.json");
      const skillsPath = join(projectDir, "data", "Skills.json");

      const beforeHashes = {
        items: hashFile(itemsPath),
        skills: hashFile(skillsPath),
      };

      project.staging.addCreate("Item", {
        name: "Test Potion",
        iconIndex: 0,
        description: "A test potion",
        itypeId: 1,
        scope: 7,
        occasion: 0,
        speed: 0,
        successRate: 100,
        repeats: 1,
        tpGain: 0,
        hitType: 0,
        animationId: 0,
        price: 100,
        consumable: true,
        damage: { type: 3, elementId: 0, formula: "100", variance: 10, critical: false },
        effects: [],
        note: "",
      });

      const result = await applyPatch(project, project.staging);
      expect(result.filesWritten).toContain(itemsPath);

      const rollbackResult = rollbackLastPatch(projectDir);
      expect(rollbackResult.restoredTransactionId).toBe(result.transactionId);
      expect(rollbackResult.filesRestored).toContain(itemsPath);

      const afterHashes = {
        items: hashFile(itemsPath),
        skills: hashFile(skillsPath),
      };

      expect(afterHashes.items).toBe(beforeHashes.items);
      expect(afterHashes.skills).toBe(beforeHashes.skills);
    });
  });

  it("refuses to apply when project is stale", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      const itemsPath = join(projectDir, "data", "Items.json");

      project.staging.addCreate("Item", {
        name: "Test Potion",
        iconIndex: 0,
        description: "A test potion",
        itypeId: 1,
        scope: 7,
        occasion: 0,
        speed: 0,
        successRate: 100,
        repeats: 1,
        tpGain: 0,
        hitType: 0,
        animationId: 0,
        price: 100,
        consumable: true,
        damage: { type: 3, elementId: 0, formula: "100", variance: 10, critical: false },
        effects: [],
        note: "",
      });

      const originalContent = readFileSync(itemsPath, "utf-8");
      const modified = JSON.parse(originalContent);
      modified.push({ id: 999, name: "External Edit" });
      writeFileSync(itemsPath, JSON.stringify(modified), "utf-8");

      await expect(applyPatch(project, project.staging)).rejects.toThrow(StaleProjectError);
    });
  });

  it("creates backups before writing", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);

      project.staging.addCreate("Item", {
        name: "Test Potion",
        iconIndex: 0,
        description: "A test potion",
        itypeId: 1,
        scope: 7,
        occasion: 0,
        speed: 0,
        successRate: 100,
        repeats: 1,
        tpGain: 0,
        hitType: 0,
        animationId: 0,
        price: 100,
        consumable: true,
        damage: { type: 3, elementId: 0, formula: "100", variance: 10, critical: false },
        effects: [],
        note: "",
      });

      const result = await applyPatch(project, project.staging);
      expect(result.backupDir).toContain(".bridge");
      expect(result.backupDir).toContain("backups");
      expect(result.transactionId).toMatch(/^t-\d+-[a-f0-9]+$/);

      expect(existsSync(result.backupDir)).toBe(true);
    });
  });

  it("records transaction in journal", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);

      project.staging.addCreate("Item", {
        name: "Test Potion",
        iconIndex: 0,
        description: "A test potion",
        itypeId: 1,
        scope: 7,
        occasion: 0,
        speed: 0,
        successRate: 100,
        repeats: 1,
        tpGain: 0,
        hitType: 0,
        animationId: 0,
        price: 100,
        consumable: true,
        damage: { type: 3, elementId: 0, formula: "100", variance: 10, critical: false },
        effects: [],
        note: "",
      });

      const result = await applyPatch(project, project.staging);

      const backup = new Backup(projectDir);
      const transactions = backup.listTransactions();

      expect(transactions).toHaveLength(1);
      expect(transactions[0].id).toBe(result.transactionId);
      expect(transactions[0].files.length).toBeGreaterThan(0);
      expect(Object.keys(transactions[0].preHashes).length).toBeGreaterThan(0);
    });
  });

  it("clears staging after successful apply", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);

      project.staging.addCreate("Item", {
        name: "Test Potion",
        iconIndex: 0,
        description: "A test potion",
        itypeId: 1,
        scope: 7,
        occasion: 0,
        speed: 0,
        successRate: 100,
        repeats: 1,
        tpGain: 0,
        hitType: 0,
        animationId: 0,
        price: 100,
        consumable: true,
        damage: { type: 3, elementId: 0, formula: "100", variance: 10, critical: false },
        effects: [],
        note: "",
      });

      expect(project.staging.list()).toHaveLength(1);

      await applyPatch(project, project.staging);

      expect(project.staging.list()).toHaveLength(0);
    });
  });
});
