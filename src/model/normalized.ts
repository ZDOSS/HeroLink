import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EngineAdapter } from "../engine/adapter.js";
import { IoError } from "../errors.js";
import type { PluginEntry } from "../io/pluginsJs.js";
import type { FileSnapshot } from "./hash.js";
import { snapshotFile } from "./hash.js";

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

export function buildNormalizedModel(projectDir: string, adapter: EngineAdapter): NormalizedModel {
  const model = new NormalizedModel(projectDir, adapter);

  for (const file of adapter.dataFiles()) {
    const filePath = join(projectDir, "data", file);

    model.fileSnapshots.set(filePath, snapshotFile(filePath));

    try {
      const content = readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);

      if (file === "System.json") {
        model.system = data as SystemData;
      } else if (file === "MapInfos.json") {
        for (let i = 1; i < data.length; i++) {
          if (data[i]) {
            model.mapInfos.set(data[i].id, data[i] as MapInfo);
          }
        }
      } else if (Array.isArray(data)) {
        const entity = FILE_TO_ENTITY[file];
        if (entity) {
          const entityMap = model.entities.get(entity);
          if (entityMap) {
            for (let i = 1; i < data.length; i++) {
              if (data[i]) {
                entityMap.set(data[i].id, data[i] as Entity);
              }
            }
          }
        }
      }
    } catch (err) {
      throw new IoError(filePath, err);
    }
  }

  const mapInfosFile = join(projectDir, "data", "MapInfos.json");
  try {
    const content = readFileSync(mapInfosFile, "utf-8");
    const mapInfos = JSON.parse(content);
    for (let i = 1; i < mapInfos.length; i++) {
      if (mapInfos[i]) {
        const mapFile = join(projectDir, "data", `Map${String(i).padStart(3, "0")}.json`);
        model.fileSnapshots.set(mapFile, snapshotFile(mapFile));
        try {
          const mapContent = readFileSync(mapFile, "utf-8");
          const mapData = JSON.parse(mapContent) as MapData;
          model.maps.set(i, mapData);
        } catch {
          // Map file might not exist
        }
      }
    }
  } catch {
    // MapInfos might not have entries
  }

  model.plugins = adapter.pluginConfig.read(projectDir);
  const pluginsFile = join(projectDir, "js", "plugins.js");
  model.fileSnapshots.set(pluginsFile, snapshotFile(pluginsFile));

  return model;
}
