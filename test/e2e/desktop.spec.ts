import { test, expect, _electron as electron } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withTempProject } from "../helpers/withTempProject.js";

test("native desktop: connect, edit, review, apply, rollback, plugin install and outage recovery", async ({}, testInfo) => {
  await withTempProject("sample-project", async (projectDir) => {
    const userData = mkdtempSync(join(tmpdir(), "herolink-desktop-"));
    const app = await electron.launch({
      args: [join(process.cwd(), "electron/main.cjs"), "--no-sandbox", "--disable-gpu"],
      env: { ...process.env, XDG_CONFIG_HOME: userData },
      timeout: 30000,
    });
    try {
      const page = await app.firstWindow();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await expect(page).toHaveTitle("HeroLink");
      await expect(page.getByRole("heading", { name: "Welcome to HeroLink" })).toBeVisible();
      // Configure via the exact preload surface used by the folder picker.
      const started = await page.evaluate(async (dir) => {
        await window.heroLinkAPI.setConfig({
          projectPath: dir,
          port: 18766,
          autoStartServer: false,
        });
        HeroLinkState.set("config", await window.heroLinkAPI.getConfig());
        return window.heroLinkAPI.restartServer();
      }, projectDir);
      expect(started).toEqual({ ok: true });
      await page.evaluate(async () => {
        await App.refreshProjectSummary();
        await App.refreshPendingCount();
      });
      await page.getByRole("button", { name: "Entities", exact: false }).click();
      await expect(page.getByRole("button", { name: "Potion", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Edit", exact: true }).first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const editor = page.getByLabel("Entity fields", { exact: true });
      const fields = JSON.parse(await editor.inputValue());
      fields.name = "Audited Potion";
      await editor.fill(JSON.stringify(fields, null, 2));
      await page.getByRole("button", { name: "Save Draft", exact: true }).click();
      await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "OK", exact: true }).click();
      await page.getByRole("button", { name: "Pending Changes", exact: false }).click();
      await page.getByRole("button", { name: "Apply All Changes", exact: true }).click();
      await page.addScriptTag({ path: fileURLToPath(import.meta.resolve("axe-core/axe.min.js")) });
      const reviewAccessibility = await page.evaluate(() =>
        window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } }),
      );
      expect(reviewAccessibility.violations).toEqual([]);
      await expect(page.getByRole("heading", { name: "Before", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "After", exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("review.png"), fullPage: true });
      await page.getByRole("button", { name: "Apply reviewed changes", exact: true }).click();
      await expect(page.getByText("Changes applied", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "OK", exact: true }).click();
      await expect(page.getByRole("heading", { name: "No Pending Changes" })).toBeVisible();
      const rolledBack = await page.evaluate(() => BridgeAPI.rollbackLast());
      expect(rolledBack.success).toBe(true);
      await page.getByRole("button", { name: "Entities", exact: false }).click();
      await expect(page.getByRole("button", { name: "Potion", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "+ New", exact: true }).click();
      const templateId = await page
        .getByLabel("Template", { exact: true })
        .locator("option")
        .nth(1)
        .getAttribute("value");
      await page.getByLabel("Template", { exact: true }).selectOption(templateId!);
      const createEditor = page.getByLabel("New entity fields", { exact: true });
      const created = JSON.parse(await createEditor.inputValue());
      expect(created.id).toBeUndefined();
      expect(created.damage).toBeDefined();
      created.name = "New complete item";
      await createEditor.fill(JSON.stringify(created));
      await page.getByRole("button", { name: "Create Draft", exact: true }).click();
      await page.getByRole("button", { name: "OK", exact: true }).click();
      await page.evaluate(() => BridgeAPI.discardPendingChanges());
      await page.getByRole("button", { name: "Plugins", exact: false }).click();
      await page.getByRole("button", { name: "+ Add Plugin", exact: true }).click();
      await page.getByLabel("Plugin Name", { exact: true }).fill("DesktopPlugin");
      await page
        .getByLabel("Plugin source code", { exact: true })
        .fill("/* desktop plugin source */");
      await page.getByRole("button", { name: "Add as Draft", exact: true }).click();
      await page.getByRole("button", { name: "OK", exact: true }).click();
      const diff = await page.evaluate(() => BridgeAPI.getDiff());
      expect(
        diff.data.files.find((f: { file: string }) => f.file.endsWith("DesktopPlugin.js")).after,
      ).toBe("/* desktop plugin source */");
      await page.evaluate(() => BridgeAPI.discardPendingChanges());
      await page.getByRole("button", { name: "Documentation", exact: false }).click();
      await page
        .getByRole("button", { name: "Stage BridgeInspector Installation", exact: true })
        .click();
      await expect(
        page.getByText("Installation drafted. Review and apply it in Pending Changes.", {
          exact: true,
        }),
      ).toBeVisible();
      expect(
        (await page.evaluate(() => BridgeAPI.getDiff())).data.files.some((f: { file: string }) =>
          f.file.endsWith("BridgeInspector.js"),
        ),
      ).toBe(true);
      await page.evaluate(() => BridgeAPI.discardPendingChanges());
      await page.evaluate(() => window.heroLinkAPI.stopServer());
      await page.getByRole("button", { name: "Pending Changes", exact: false }).click();
      await expect(page.getByRole("alert")).toContainText("Could not load pending changes");
      await expect(page.getByRole("heading", { name: "No Pending Changes" })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath("outage.png"), fullPage: true });
      expect((await page.evaluate(() => window.heroLinkAPI.restartServer())).ok).toBe(true);
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await expect(page.getByRole("heading", { name: "No Pending Changes" })).toBeVisible();
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 650));
      await page.getByRole("button", { name: "Settings", exact: false }).click();
      await page.addScriptTag({ path: fileURLToPath(import.meta.resolve("axe-core/axe.min.js")) });
      for (const view of [
        "dashboard",
        "entities",
        "maps",
        "plugins",
        "pending",
        "backups",
        "settings",
      ]) {
        await page.evaluate((view) => App.renderView(view), view);
        const accessibility = await page.evaluate(() =>
          window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } }),
        );
        expect(accessibility.violations, view).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
      await page.evaluate(() => App.renderView("entities"));
      await page.getByRole("button", { name: "Edit", exact: true }).first().focus();
      await page.keyboard.press("Enter");
      await expect(page.getByLabel("Entity fields", { exact: true })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Edit", exact: true }).first()).toBeFocused();
      expect(errors).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath("desktop.png"), fullPage: true });
    } finally {
      await app.close();
      rmSync(userData, { recursive: true, force: true });
    }
  });
});
