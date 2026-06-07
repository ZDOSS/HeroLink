import { Command } from "commander";
import { loadProject } from "./io/project.js";
import { getEntity } from "./tools/getEntity.js";
import { getMapEvents } from "./tools/getMapEvents.js";
import { getProjectStatus } from "./tools/getProjectStatus.js";
import { listEntities } from "./tools/listEntities.js";
import { listMaps } from "./tools/listMaps.js";
import { listPlugins } from "./tools/listPlugins.js";
import { listProjectData } from "./tools/listProjectData.js";
import { searchEvents } from "./tools/searchEvents.js";
import { searchNotes } from "./tools/searchNotes.js";

const program = new Command();

program.name("rpgmv-bridge").description("RPG Maker MV Content Bridge CLI").version("0.1.0");

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

program.parse();
