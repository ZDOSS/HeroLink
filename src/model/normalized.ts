import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { EngineAdapter } from "../engine/adapter.js";
import { IoError } from "../errors.js";
import { resolveProjectPathSafe } from "../io/paths.js";
import type { PluginEntry } from "../io/pluginsJs.js";
import { parsePluginsJs } from "../io/pluginsJs.js";
import type { FileSnapshot } from "./hash.js";
import { hashContent, snapshotFile } from "./hash.js";

export type EntityType =
  | "Actor"
  | "Class"
  | "Skill"
  | "Item"
  | "Weapon"
  | "Armor"
  | "Enemy"
  | "Troop"
  | "State"
  | "Animation"
  | "Tileset"
  | "CommonEvent";

export interface Entity {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface MapInfo {
  id: number;
  name: string;
  parentId: number;
  order: number;
  expanded: boolean;
  scrollX: number;
  scrollY: number;
}

export interface MapEvent {
  id: number;
  name: string;
  x: number;
  y: number;
  pages: unknown[];
  note: string;
}

export interface MapData {
  width: number;
  height: number;
  tilesetId: number;
  events: (MapEvent | null)[];
  data: number[];
  [key: string]: unknown;
}

export interface SystemData {
  gameTitle: string;
  versionId: number;
  currencyUnit: string;
  elements: string[];
  skillTypes: string[];
  weaponTypes: string[];
  armorTypes: string[];
  equipTypes: string[];
  switches: string[];
  variables: string[];
  startMapId: number;
  startX: number;
  startY: number;
  partyMembers: number[];
  [key: string]: unknown;
}

export class NormalizedModel {
  readonly entities = new Map<EntityType, Map<number, Entity>>();
  readonly mapInfos = new Map<number, MapInfo>();
  readonly maps = new Map<number, MapData>();
  system!: SystemData;
  plugins: PluginEntry[] = [];
  readonly fileSnapshots = new Map<string, FileSnapshot>();
  readonly documents = new Map<string, unknown>();
  readonly referenceGraph = new Map<string, Set<string>>();

  constructor(
    readonly projectDir: string,
    readonly adapter: EngineAdapter,
  ) {
    for (const type of this.getEntityTypes()) {
      this.entities.set(type, new Map());
    }
  }

  getEntityTypes(): EntityType[] {
    return [
      "Actor",
      "Class",
      "Skill",
      "Item",
      "Weapon",
      "Armor",
      "Enemy",
      "Troop",
      "State",
      "Animation",
      "Tileset",
      "CommonEvent",
    ];
  }

  getEntity(type: EntityType, id: number): Entity | undefined {
    return this.entities.get(type)?.get(id);
  }

  listEntities(type: EntityType): Entity[] {
    const map = this.entities.get(type);
    return map ? Array.from(map.values()) : [];
  }

  listMapInfos(): MapInfo[] {
    return Array.from(this.mapInfos.values());
  }

  getMapEvents(mapId: number): MapEvent[] {
    const map = this.maps.get(mapId);
    if (!map) return [];
    return map.events.filter((e): e is MapEvent => e !== null);
  }
}

const FILE_TO_ENTITY: Record<string, EntityType> = {
  "Actors.json": "Actor",
  "Classes.json": "Class",
  "Skills.json": "Skill",
  "Items.json": "Item",
  "Weapons.json": "Weapon",
  "Armors.json": "Armor",
  "Enemies.json": "Enemy",
  "Troops.json": "Troop",
  "States.json": "State",
  "Animations.json": "Animation",
  "Tilesets.json": "Tileset",
  "CommonEvents.json": "CommonEvent",
};

// Raw documents are retained so validation sees array indices and duplicate IDs.
export function modelFromDocuments(
  projectDir: string,
  adapter: EngineAdapter,
  documents: Map<string, unknown>,
  plugins: PluginEntry[],
): NormalizedModel {
  const model = new NormalizedModel(projectDir, adapter);
  for (const [file, data] of documents) {
    model.documents.set(file, data);
    if (file === "System.json") model.system = data as SystemData;
    else if (file === "MapInfos.json" && Array.isArray(data)) {
      for (const entry of data) if (entry) model.mapInfos.set(entry.id, entry);
    } else if (/^Map\d+\.json$/.test(file))
      model.maps.set(Number(file.slice(3, -5)), data as MapData);
    else if (FILE_TO_ENTITY[file] && Array.isArray(data)) {
      for (const entry of data)
        if (entry) model.entities.get(FILE_TO_ENTITY[file])?.set(entry.id, entry);
    }
  }
  model.plugins = plugins;
  return model;
}

export function buildNormalizedModel(projectDir: string, adapter: EngineAdapter): NormalizedModel {
  const snapshots = new Map<string, FileSnapshot>();
  function read(rel: string): string {
    const file = resolveProjectPathSafe(projectDir, rel);
    try {
      const content = readFileSync(file, "utf8");
      snapshots.set(file, { hash: hashContent(content), mtime: statSync(file).mtimeMs });
      return content;
    } catch (error) {
      throw new IoError(file, error);
    }
  }
  const model = loadModelFromText(projectDir, adapter, read);
  const pluginDir = resolveProjectPathSafe(projectDir, "js/plugins");
  if (existsSync(pluginDir))
    for (const name of readdirSync(pluginDir)) {
      if (name.endsWith(".js")) {
        const file = resolveProjectPathSafe(projectDir, join("js/plugins", name));
        snapshots.set(file, snapshotFile(file));
      }
    }
  for (const plugin of model.plugins) {
    if (plugin.status) {
      const file = resolveProjectPathSafe(projectDir, join("js/plugins", `${plugin.name}.js`));
      if (!existsSync(file)) throw new IoError(file, "Referenced enabled plugin source is missing");
    }
  }
  for (const entry of snapshots) model.fileSnapshots.set(...entry);
  return model;
}

export function reloadModel(model: NormalizedModel): void {
  // Build first, then swap every collection. Failed reads leave the session intact.
  // Apply/rollback call this before returning, so subsequent allocations see fresh IDs.
  const replacement = buildNormalizedModel(model.projectDir, model.adapter);
  for (const key of [
    "entities",
    "mapInfos",
    "maps",
    "documents",
    "fileSnapshots",
    "referenceGraph",
  ] as const) {
    const target = model[key] as Map<unknown, unknown>;
    target.clear();
    for (const [k, v] of replacement[key]) target.set(k, v);
  }
  model.system = replacement.system;
  model.plugins = replacement.plugins;
}

// Central parser for disk reads and transaction recovery's captured byte view.
export function loadModelFromText(
  projectDir: string,
  adapter: EngineAdapter,
  read: (relative: string) => string,
): NormalizedModel {
  const documents = new Map<string, unknown>();
  function readJson(file: string): unknown {
    try {
      return JSON.parse(read(`data/${file}`));
    } catch (error) {
      if (error instanceof IoError) throw error;
      throw new IoError(file, error);
    }
  }
  for (const file of adapter.dataFiles()) documents.set(file, readJson(file));
  const mapInfos = documents.get("MapInfos.json");
  if (!Array.isArray(mapInfos)) throw new IoError("MapInfos.json", "Expected an indexed array");
  for (let i = 1; i < mapInfos.length; i++) {
    if (mapInfos[i]) {
      const name = `Map${String(i).padStart(3, "0")}.json`;
      documents.set(name, readJson(name));
    }
  }
  const plugins = parsePluginsJs(read("js/plugins.js"));
  return modelFromDocuments(projectDir, adapter, documents, plugins);
}
