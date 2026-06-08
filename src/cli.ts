import { readFileSync } from "node:fs";
import { Command } from "commander";
import { loadProject } from "./io/project.js";
import { addPluginDraft } from "./tools/addPluginDraft.js";
import { applyPatchTool } from "./tools/applyPatchTool.js";
import { diffPendingChanges } from "./tools/diffPendingChanges.js";
import { discardPendingChanges } from "./tools/discardPendingChanges.js";
import { getEntity } from "./tools/getEntity.js";
import { getMapEvents } from "./tools/getMapEvents.js";
import { getProjectStatus } from "./tools/getProjectStatus.js";
import { InspectRuntimeInput, inspectRuntime } from "./tools/inspectRuntime.js";
import { listBackups } from "./tools/listBackups.js";
import { listEntities } from "./tools/listEntities.js";
import { listMaps } from "./tools/listMaps.js";
import { listPendingChanges } from "./tools/listPendingChanges.js";
import { listPlugins } from "./tools/listPlugins.js";
import { listProjectData } from "./tools/listProjectData.js";
import { PreviewEntityInput, previewEntity } from "./tools/previewEntity.js";
import { rollbackLastPatchTool } from "./tools/rollbackLastPatchTool.js";
import { searchEvents } from "./tools/searchEvents.js";
import { searchNotes } from "./tools/searchNotes.js";
import { setPluginParamDraft } from "./tools/setPluginParamDraft.js";
import { validateProjectRefs } from "./tools/validateProjectRefs.js";

const program = new Command();

program.name("rpgmv-bridge").description("RPG Maker MV Content Bridge CLI").version("0.3.0");

program
  .command("status <projectDir>")
  .description("Get project status")
  .action((projectDir: string) => {
    const project = loadProject(projectDir);
    const result = getProjectStatus(project);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("data <projectDir>")
  .description("List project data counts")
  .action((projectDir: string) => {
    const project = loadProject(projectDir);
    const result = listProjectData(project);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("list <projectDir> <type>")
  .description("List entities by type")
  .option("-q, --query <query>", "Filter by name")
  .option("-l, --limit <limit>", "Limit results", Number.parseInt)
  .option("-o, --offset <offset>", "Offset results", Number.parseInt)
  .action(
    (
      projectDir: string,
      type: string,
      opts: { query?: string; limit?: number; offset?: number },
    ) => {
      const project = loadProject(projectDir);
      const result = listEntities(project, {
        type: type as never,
        query: opts.query,
        limit: opts.limit,
        offset: opts.offset,
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    },
  );

program
  .command("get <projectDir> <type> <id>")
  .description("Get entity by type and id")
  .action((projectDir: string, type: string, id: string) => {
    const project = loadProject(projectDir);
    const result = getEntity(project, { type: type as never, id: Number.parseInt(id) });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("maps <projectDir>")
  .description("List maps")
  .action((projectDir: string) => {
    const project = loadProject(projectDir);
    const result = listMaps(project);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("events <projectDir> <mapId>")
  .description("Get map events")
  .action((projectDir: string, mapId: string) => {
    const project = loadProject(projectDir);
    const result = getMapEvents(project, { mapId: Number.parseInt(mapId) });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("search <projectDir> <query>")
  .description("Search events")
  .option("-s, --scope <scope>", "Search scope (all, common, map)", "all")
  .action((projectDir: string, query: string, opts: { scope: string }) => {
    const project = loadProject(projectDir);
    const result = searchEvents(project, { query, scope: opts.scope as "all" | "common" | "map" });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("notes <projectDir> <query>")
  .description("Search notes")
  .action((projectDir: string, query: string) => {
    const project = loadProject(projectDir);
    const result = searchNotes(project, { query });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("plugins <projectDir>")
  .description("List plugins")
  .action((projectDir: string) => {
    const project = loadProject(projectDir);
    const result = listPlugins(project);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("validate <projectDir>")
  .description("Audit project for broken references and integrity issues")
  .action((projectDir: string) => {
    const project = loadProject(projectDir);
    const result = validateProjectRefs(project);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("pending <projectDir>")
  .description("List pending draft changes")
  .action((projectDir: string) => {
    const project = loadProject(projectDir);
    const result = listPendingChanges(project, project.staging);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("diff <projectDir>")
  .description("Show JSON Patch diff of pending changes")
  .action((projectDir: string) => {
    const project = loadProject(projectDir);
    const result = diffPendingChanges(project, project.staging);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("discard <projectDir>")
  .description("Discard all pending draft changes")
  .action((projectDir: string) => {
    const project = loadProject(projectDir);
    const result = discardPendingChanges(project, project.staging, {});
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("apply <projectDir>")
  .description("Apply all pending changes")
  .action(async (projectDir: string) => {
    const project = loadProject(projectDir);
    const result = await applyPatchTool(project, project.staging, { confirm: true });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("rollback <projectDir>")
  .description("Rollback the last applied transaction")
  .action((projectDir: string) => {
    const project = loadProject(projectDir);
    const result = rollbackLastPatchTool(project);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("backups <projectDir>")
  .description("List all backup transactions")
  .action((projectDir: string) => {
    const project = loadProject(projectDir);
    const result = listBackups(project);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("set-plugin-param <projectDir> <pluginName> <key> <value>")
  .description("Set a plugin parameter")
  .action((projectDir: string, pluginName: string, key: string, value: string) => {
    const project = loadProject(projectDir);
    const result = setPluginParamDraft(project, project.staging, {
      pluginName,
      params: { [key]: value },
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("add-plugin <projectDir> <name> <sourceFile>")
  .description("Add a new plugin from a source file")
  .option("--no-status", "Add plugin as disabled")
  .action((projectDir: string, name: string, sourceFile: string, opts: { status: boolean }) => {
    const project = loadProject(projectDir);
    const source = readFileSync(sourceFile, "utf-8");
    const result = addPluginDraft(project, project.staging, {
      name,
      source,
      status: opts.status,
      params: {},
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("inspect-runtime <projectDir>")
  .description("Inspect runtime state from a running game")
  .option("--refresh", "Send INSPECT command to refresh state")
  .option("--timeout <ms>", "Timeout in milliseconds", "5000")
  .action(async (projectDir: string, opts: { refresh?: boolean; timeout: string }) => {
    const project = loadProject(projectDir);
    const parsed = InspectRuntimeInput.safeParse({
      refresh: opts.refresh ?? false,
      timeoutMs: Number.parseInt(opts.timeout, 10),
    });
    if (!parsed.success) {
      process.stderr.write(
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}\n`,
      );
      process.exit(1);
    }
    const result = await inspectRuntime(project, parsed.data);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("preview-entity <projectDir> <type> <id>")
  .description("Preview an item or skill in a running game")
  .option("--timeout <ms>", "Timeout in milliseconds", "5000")
  .action(async (projectDir: string, type: string, id: string, opts: { timeout: string }) => {
    const project = loadProject(projectDir);
    const parsed = PreviewEntityInput.safeParse({
      type,
      id: Number.parseInt(id, 10),
      timeoutMs: Number.parseInt(opts.timeout, 10),
    });
    if (!parsed.success) {
      process.stderr.write(
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}\n`,
      );
      process.exit(1);
    }
    const result = await previewEntity(project, parsed.data);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program.parse();
