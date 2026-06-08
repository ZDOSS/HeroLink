import { describe, it, expect } from "vitest";
import { withTempProject } from "../helpers/withTempProject.js";

describe("HTTP server", () => {
  it("starts and responds on the tools endpoint", async () => {
    await withTempProject("sample-project", async (projectDir) => {
      const oldDir = process.env.RPGMV_PROJECT_DIR;
      process.env.RPGMV_PROJECT_DIR = projectDir;
      try {
        const { startHttpServer } = await import("../../src/http/server.js");
        const fastify = await startHttpServer(0, "127.0.0.1");
        const address = fastify.server.address();
        const port = typeof address === "object" && address ? address.port : 0;

        const resp = await fetch(`http://127.0.0.1:${port}/tools`);
        const data = await resp.json() as { tools: Array<{ name: string }> };
        expect(data.tools.length).toBeGreaterThan(10);
        expect(data.tools.some((t) => t.name === "get_project_status")).toBe(true);

        // Test a specific tool
        const statusResp = await fetch(`http://127.0.0.1:${port}/tools/get_project_status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const statusData = await statusResp.json() as { ok: boolean; result: { engine: string } };
        expect(statusData.ok).toBe(true);
        expect(statusData.result.engine).toBe("mv");

        await fastify.close();
      } finally {
        process.env.RPGMV_PROJECT_DIR = oldDir;
      }
    });
  });
});
