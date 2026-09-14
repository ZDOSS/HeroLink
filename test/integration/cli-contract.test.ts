import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { loadProject } from "../../src/io/project.js";
import { withTempProject } from "../helpers/withTempProject.js";
const run = (...args: string[]) =>
  spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
    encoding: "utf8",
    timeout: 15000,
  });
describe("production CLI contract", () => {
  it("uses the production schema and reserves stdout across read and invalid mutation requests", async () => {
    await withTempProject("sample-project", async (dir) => {
      const p = loadProject(dir);
      const status = run("status", dir);
      expect(status.status, status.stderr).toBe(0);
      expect(status.stdout).toBe("");
      expect(JSON.parse(status.stderr).gameTitle).toBe(p.model.system.gameTitle);
      const list = run("list", dir, "Item", "--limit", "1oops");
      expect(list.status).toBe(1);
      expect(list.stdout).toBe("");
      expect(JSON.parse(list.stderr).code).toBe("ValidationError");
      const draft = run(
        "call",
        dir,
        "create_item_draft",
        JSON.stringify({ fields: { name: "Incomplete" } }),
      );
      expect(draft.status).toBe(1);
      expect(JSON.parse(draft.stderr).code).toBe("ValidationError");
      expect(p.staging.list()).toEqual([]);
      const help = run("--help");
      expect(help.stdout).toBe("");
      expect(help.stderr).toContain("apply");
    });
  });
});
