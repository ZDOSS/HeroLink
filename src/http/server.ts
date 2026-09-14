import { pathToFileURL } from "node:url";
import Fastify from "fastify";
import { z } from "zod";
import { errorDetails } from "../errors.js";
import { type Project, loadProject } from "../io/project.js";
import { logger } from "../log.js";
import { TOOL_DEFS, callTool } from "../tools/registry.js";

export function createHttpServer(project: Project, token = process.env.HEROLINK_TOKEN) {
  const fastify = Fastify({ logger: false, bodyLimit: 8 * 1024 * 1024 });
  fastify.addHook("onRequest", async (request, reply) => {
    // Desktop calls originate in the main process. Browser origins and DNS
    // rebinding hostnames never get access to local project mutation endpoints.
    const host = request.headers.host ?? "";
    if (request.headers.origin || !/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)) {
      return reply.code(403).send({
        ok: false,
        code: "Forbidden",
        error: "Local API requires a loopback host and no browser Origin",
      });
    }
    if (token && request.headers.authorization !== `Bearer ${token}`)
      return reply.code(401).send({ ok: false, code: "Unauthorized", error: "Invalid API token" });
  });
  fastify.get("/health", async () => ({
    ok: true,
    projectDir: project.projectDir,
    pid: process.pid,
  }));
  const list = async () => ({
    tools: TOOL_DEFS.map((t) => ({ name: t.name, description: t.description })),
  });
  fastify.get("/tools", list);
  fastify.get("/api/tools", list);
  for (const def of TOOL_DEFS)
    for (const prefix of ["/tools/", "/api/tools/"]) {
      fastify.post(prefix + def.name, async (request, reply) => {
        try {
          return { ok: true, result: await callTool(project, def.name, request.body ?? {}) };
        } catch (error) {
          const detail = errorDetails(error);
          logger.error({ tool: def.name, ...detail }, "Tool error");
          return reply
            .code(
              detail.code === "ConflictError" || detail.code === "StaleProjectError"
                ? 409
                : detail.code === "ValidationError" || detail.code === "RefIntegrityError"
                  ? 400
                  : detail.code === "NotFoundError"
                    ? 404
                    : 500,
            )
            .send({ ok: false, ...detail });
        }
      });
    }
  return fastify;
}

export async function startHttpServer(port = 8866, host = "127.0.0.1") {
  z.number().int().min(0).max(65535).parse(port);
  z.enum(["127.0.0.1", "::1", "localhost"]).parse(host);
  const dir = process.env.RPGMV_PROJECT_DIR;
  if (!dir) throw new Error("RPGMV_PROJECT_DIR environment variable not set");
  const server = createHttpServer(loadProject(dir));
  await server.listen({ port, host });
  logger.info({ port, host }, "HTTP server started");
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startHttpServer(
    Number(process.env.HTTP_PORT ?? 8866),
    process.env.HTTP_HOST ?? "127.0.0.1",
  ).catch((error) => {
    logger.error({ error }, "Failed to start HTTP server");
    process.exitCode = 1;
  });
}
