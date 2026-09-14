import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { errorDetails } from "./errors.js";
import { type Project, loadProject } from "./io/project.js";
import { logger } from "./log.js";
import { TOOL_DEFS, callTool } from "./tools/registry.js";

export function createMcpServer(project: Project): Server {
  const server = new Server(
    { name: "rpgmv-bridge", version: "0.3.0" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema),
      outputSchema: zodToJsonSchema(t.outputSchema),
    })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await callTool(project, request.params.name, request.params.arguments ?? {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: z.record(z.unknown()).parse(result),
      };
    } catch (error) {
      const detail = errorDetails(error);
      logger.error(detail, "Tool error");
      return { content: [{ type: "text", text: JSON.stringify(detail) }], isError: true };
    }
  });
  return server;
}
export async function main(): Promise<void> {
  const dir = process.env.RPGMV_PROJECT_DIR;
  if (!dir) throw new Error("RPGMV_PROJECT_DIR environment variable not set");
  await createMcpServer(loadProject(dir)).connect(new StdioServerTransport());
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    logger.error({ error }, "Server failed");
    process.exitCode = 1;
  });
}
