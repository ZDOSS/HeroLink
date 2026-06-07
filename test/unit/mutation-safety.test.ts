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

  it("chained rollbacks unwind transactions in reverse order", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      const itemsPath = join(projectDir, "data", "Items.json");
      const skillsPath = join(projectDir, "data", "Skills.json");

      const originalItemsHash = hashFile(itemsPath);
      const originalSkillsHash = hashFile(skillsPath);

      // Transaction 1: Add an item
      project.staging.addCreate("Item", {
        name: "Potion A",
        iconIndex: 0,
        description: "First potion",
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

      const result1 = await applyPatch(project, project.staging);
      const afterT1ItemsHash = hashFile(itemsPath);
      expect(afterT1ItemsHash).not.toBe(originalItemsHash);

      // Transaction 2: Add a skill (need fresh project for staging)
      const project2 = loadProject(projectDir);
      project2.staging.addCreate("Skill", {
        name: "Fire",
        iconIndex: 0,
        description: "Fire spell",
        stypeId: 1,
        mpCost: 10,
        tpCost: 0,
        scope: 1,
        occasion: 1,
        speed: 0,
        successRate: 100,
        repeats: 1,
        tpGain: 0,
        hitType: 1,
        animationId: 0,
        message1: "casts Fire!",
        message2: "",
        requiredWtypeId1: 0,
        requiredWtypeId2: 0,
        damage: { type: 1, elementId: 1, formula: "a.mat * 4", variance: 20, critical: false },
        effects: [],
        note: "",
      });

      const result2 = await applyPatch(project2, project2.staging);
      const afterT2SkillsHash = hashFile(skillsPath);
      expect(afterT2SkillsHash).not.toBe(originalSkillsHash);

      // Rollback T2 first
      const rollback2 = rollbackLastPatch(projectDir);
      expect(rollback2.restoredTransactionId).toBe(result2.transactionId);
      expect(hashFile(skillsPath)).toBe(originalSkillsHash);
      expect(hashFile(itemsPath)).toBe(afterT1ItemsHash); // T1 still applied

      // Rollback T1
      const rollback1 = rollbackLastPatch(projectDir);
      expect(rollback1.restoredTransactionId).toBe(result1.transactionId);
      expect(hashFile(itemsPath)).toBe(originalItemsHash);

      // No more transactions to rollback
      expect(() => rollbackLastPatch(projectDir)).toThrow("No transactions to rollback");
    });
  });

  it("preview IDs account for pending creates of the same type", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);

      const entities = project.model.listEntities("Item");
      const maxId = entities.reduce((max, e) => Math.max(max, e.id), 0);

      // First create draft - should preview maxId + 1
      const { createItemDraft } = await import("../../src/tools/createItemDraft.js");
      const result1 = createItemDraft(project, project.staging, {
        fields: {
          name: "Potion A",
          iconIndex: 0,
          description: "First",
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
        },
      });

      expect((result1.preview.fields as Record<string, unknown>).id).toBe(maxId + 1);

      // Second create draft - should preview maxId + 2
      const result2 = createItemDraft(project, project.staging, {
        fields: {
          name: "Potion B",
          iconIndex: 0,
          description: "Second",
          itypeId: 1,
          scope: 7,
          occasion: 0,
          speed: 0,
          successRate: 100,
          repeats: 1,
          tpGain: 0,
          hitType: 0,
          animationId: 0,
          price: 200,
          consumable: true,
          damage: { type: 3, elementId: 0, formula: "200", variance: 10, critical: false },
          effects: [],
          note: "",
        },
      });

      expect((result2.preview.fields as Record<string, unknown>).id).toBe(maxId + 2);
    });
  });

  it("multi-create batch assigns sequential IDs", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      const itemsPath = join(projectDir, "data", "Items.json");

      const beforeItems = JSON.parse(readFileSync(itemsPath, "utf-8"));
      const beforeMaxId = beforeItems.length - 1;

      // Create three items in a single batch
      project.staging.addCreate("Item", {
        name: "Potion A",
        iconIndex: 0,
        description: "First",
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

      project.staging.addCreate("Item", {
        name: "Potion B",
        iconIndex: 0,
        description: "Second",
        itypeId: 1,
        scope: 7,
        occasion: 0,
        speed: 0,
        successRate: 100,
        repeats: 1,
        tpGain: 0,
        hitType: 0,
        animationId: 0,
        price: 200,
        consumable: true,
        damage: { type: 3, elementId: 0, formula: "200", variance: 10, critical: false },
        effects: [],
        note: "",
      });

      project.staging.addCreate("Item", {
        name: "Potion C",
        iconIndex: 0,
        description: "Third",
        itypeId: 1,
        scope: 7,
        occasion: 0,
        speed: 0,
        successRate: 100,
        repeats: 1,
        tpGain: 0,
        hitType: 0,
        animationId: 0,
        price: 300,
        consumable: true,
        damage: { type: 3, elementId: 0, formula: "300", variance: 10, critical: false },
        effects: [],
        note: "",
      });

      // Apply the batch
      await applyPatch(project, project.staging);

      // Verify all three items were created with sequential IDs
      const afterItems = JSON.parse(readFileSync(itemsPath, "utf-8"));
      expect(afterItems.length).toBe(beforeItems.length + 3);

      const nonNullItems = afterItems.filter((i: unknown) => i !== null);
      const itemA = nonNullItems.find((i: { name: string }) => i.name === "Potion A");
      const itemB = nonNullItems.find((i: { name: string }) => i.name === "Potion B");
      const itemC = nonNullItems.find((i: { name: string }) => i.name === "Potion C");

      expect(itemA.id).toBe(beforeMaxId + 1);
      expect(itemB.id).toBe(beforeMaxId + 2);
      expect(itemC.id).toBe(beforeMaxId + 3);
    });
  });

  it("multiple applies work in same session without reload", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const project = loadProject(projectDir);
      const itemsPath = join(projectDir, "data", "Items.json");
      const skillsPath = join(projectDir, "data", "Skills.json");

      // First apply: add an item
      project.staging.addCreate("Item", {
        name: "Potion A",
        iconIndex: 0,
        description: "First potion",
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

      const result1 = await applyPatch(project, project.staging);
      expect(result1.filesWritten).toContain(itemsPath);

      // Second apply: add a skill (using SAME project instance, no reload)
      project.staging.addCreate("Skill", {
        name: "Fire",
        iconIndex: 0,
        description: "Fire spell",
        stypeId: 1,
        mpCost: 10,
        tpCost: 0,
        scope: 1,
        occasion: 1,
        speed: 0,
        successRate: 100,
        repeats: 1,
        tpGain: 0,
        hitType: 1,
        animationId: 0,
        message1: "casts Fire!",
        message2: "",
        requiredWtypeId1: 0,
        requiredWtypeId2: 0,
        damage: { type: 1, elementId: 1, formula: "a.mat * 4", variance: 20, critical: false },
        effects: [],
        note: "",
      });

      // This should NOT throw StaleProjectError
      const result2 = await applyPatch(project, project.staging);
      expect(result2.filesWritten).toContain(skillsPath);

      // Third apply: add another item (still same session)
      project.staging.addCreate("Item", {
        name: "Potion B",
        iconIndex: 0,
        description: "Second potion",
        itypeId: 1,
        scope: 7,
        occasion: 0,
        speed: 0,
        successRate: 100,
        repeats: 1,
        tpGain: 0,
        hitType: 0,
        animationId: 0,
        price: 200,
        consumable: true,
        damage: { type: 3, elementId: 0, formula: "200", variance: 10, critical: false },
        effects: [],
        note: "",
      });

      const result3 = await applyPatch(project, project.staging);
      expect(result3.filesWritten).toContain(itemsPath);

      // Verify all changes were applied
      const finalItems = JSON.parse(readFileSync(itemsPath, "utf-8"));
      const finalSkills = JSON.parse(readFileSync(skillsPath, "utf-8"));

      const nonNullItems = finalItems.filter((i: unknown) => i !== null);
      const nonNullSkills = finalSkills.filter((s: unknown) => s !== null);

      expect(nonNullItems.find((i: { name: string }) => i.name === "Potion A")).toBeDefined();
      expect(nonNullItems.find((i: { name: string }) => i.name === "Potion B")).toBeDefined();
      expect(nonNullSkills.find((s: { name: string }) => s.name === "Fire")).toBeDefined();
    });
  });
});
