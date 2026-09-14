import { readFileSync } from "node:fs";
import { Command } from "commander";
import { errorDetails } from "./errors.js";
import { loadProject } from "./io/project.js";
import { callTool } from "./tools/registry.js";

const program = new Command().configureOutput({
  writeOut: (text) => process.stderr.write(text),
  writeErr: (text) => process.stderr.write(text),
});

program.name("rpgmv-bridge").description("RPG Maker MV Content Bridge CLI").version("0.3.0");

program
  .command("status <projectDir>")
  .description("Get project status")
  .action(async (projectDir: string) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "get_project_status");
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("data <projectDir>")
  .description("List project data counts")
  .action(async (projectDir: string) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "list_project_data");
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("list <projectDir> <type>")
  .description("List entities by type")
  .option("-q, --query <query>", "Filter by name")
  .option("-l, --limit <limit>", "Limit results", Number)
  .option("-o, --offset <offset>", "Offset results", Number)
  .action(
    async (
      projectDir: string,
      type: string,
      opts: { query?: string; limit?: number; offset?: number },
    ) => {
      const project = loadProject(projectDir);
      const result = await callTool(project, "list_entities", {
        type,
        query: opts.query,
        limit: opts.limit,
        offset: opts.offset,
      });
      process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
    },
  );

program
  .command("get <projectDir> <type> <id>")
  .description("Get entity by type and id")
  .action(async (projectDir: string, type: string, id: string) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "get_entity", { type, id: Number(id) });
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("maps <projectDir>")
  .description("List maps")
  .action(async (projectDir: string) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "list_maps");
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("events <projectDir> <mapId>")
  .description("Get map events")
  .action(async (projectDir: string, mapId: string) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "get_map_events", { mapId: Number(mapId) });
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("search <projectDir> <query>")
  .description("Search events")
  .option("-s, --scope <scope>", "Search scope (all, common, map)", "all")
  .action(async (projectDir: string, query: string, opts: { scope: string }) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "search_events", { query, scope: opts.scope });
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("notes <projectDir> <query>")
  .description("Search notes")
  .action(async (projectDir: string, query: string) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "search_notes", { query });
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("plugins <projectDir>")
  .description("List plugins")
  .action(async (projectDir: string) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "list_plugins");
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("validate <projectDir>")
  .description("Audit project for broken references and integrity issues")
  .option("--pending", "Include pending drafts")
  .action(async (projectDir: string, opts: { pending?: boolean }) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "validate_project_refs", {
      includePending: opts.pending ?? false,
    });
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("pending <projectDir>")
  .description("List pending draft changes")
  .action(async (projectDir: string) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "list_pending_changes");
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("diff <projectDir>")
  .description("Show JSON Patch diff of pending changes")
  .action(async (projectDir: string) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "diff_pending_changes");
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("discard <projectDir>")
  .description("Discard all pending draft changes")
  .action(async (projectDir: string) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "discard_pending_changes", {});
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("apply <projectDir>")
  .description("Apply the reviewed pending revision")
  .requiredOption("--revision <revision>", "Revision returned by diff")
  .action(async (projectDir: string, opts: { revision: string }) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "apply_patch", {
      confirm: true,
      expectedRevision: opts.revision,
    });
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("rollback <projectDir>")
  .description("Rollback the last applied transaction")
  .action(async (projectDir: string) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "rollback_last_patch");
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("backups <projectDir>")
  .description("List all backup transactions")
  .action(async (projectDir: string) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "list_backups");
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("set-plugin-param <projectDir> <pluginName> <key> <value>")
  .description("Set a plugin parameter")
  .action(async (projectDir: string, pluginName: string, key: string, value: string) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "set_plugin_param_draft", {
      pluginName,
      params: { [key]: value },
    });
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("add-plugin <projectDir> <name> <sourceFile>")
  .description("Add a new plugin from a source file")
  .option("--no-status", "Add plugin as disabled")
  .action(
    async (projectDir: string, name: string, sourceFile: string, opts: { status: boolean }) => {
      const project = loadProject(projectDir);
      const source = readFileSync(sourceFile, "utf-8");
      const result = await callTool(project, "add_plugin_draft", {
        name,
        source,
        status: opts.status,
        params: {},
      });
      process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
    },
  );

program
  .command("inspect-runtime <projectDir>")
  .description("Inspect runtime state from a running game")
  .option("--refresh", "Send INSPECT command to refresh state")
  .option("--timeout <ms>", "Timeout in milliseconds", "5000")
  .action(async (projectDir: string, opts: { refresh?: boolean; timeout: string }) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "inspect_runtime", {
      refresh: opts.refresh ?? false,
      timeoutMs: Number(opts.timeout),
    });
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("preview-entity <projectDir> <type> <id>")
  .description("Preview an item or skill in a running game")
  .option("--timeout <ms>", "Timeout in milliseconds", "5000")
  .action(async (projectDir: string, type: string, id: string, opts: { timeout: string }) => {
    const project = loadProject(projectDir);
    const result = await callTool(project, "preview_entity", {
      type,
      id: Number(id),
      timeoutMs: Number(opts.timeout),
    });
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("call <projectDir> <tool> [json]")
  .description("Call any registered tool with schema-validated JSON")
  .action(async (dir: string, tool: string, json = "{}") => {
    const result = await callTool(loadProject(dir), tool, JSON.parse(json));
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  });
program.parseAsync().catch((error) => {
  process.stderr.write(`${JSON.stringify(errorDetails(error))}\n`);
  process.exitCode = 1;
});
