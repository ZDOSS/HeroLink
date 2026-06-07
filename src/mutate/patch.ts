import type fjp from "fast-json-patch";
import type { EntityType } from "../model/normalized.js";
import type {
  AddPluginDraft,
  CreateDraft,
  CreateMapEventDraft,
  Draft,
  SetPluginParamsDraft,
  UpdateDraft,
  UpdateMapEventDraft,
} from "./staging.js";

const ENTITY_FILE_MAP: Record<EntityType, string> = {
  Actor: "Actors.json",
  Class: "Classes.json",
  Skill: "Skills.json",
  Item: "Items.json",
  Weapon: "Weapons.json",
  Armor: "Armors.json",
  Enemy: "Enemies.json",
  Troop: "Troops.json",
  State: "States.json",
  Animation: "Animations.json",
  Tileset: "Tilesets.json",
  CommonEvent: "CommonEvents.json",
};

export interface JsonFilePatch {
  kind: "jsonPatch";
  file: string;
  ops: fjp.Operation[];
}

export interface PluginConfigWrite {
  kind: "pluginConfig";
  entries: PluginEntry[];
}

export interface PluginFileWrite {
  kind: "pluginFile";
  name: string;
  source: string;
}

export type WritePlan = JsonFilePatch | PluginConfigWrite | PluginFileWrite;

export interface PluginEntry {
  name: string;
  status: boolean;
  description: string;
  parameters: Record<string, string>;
}

export function entityFile(entityType: EntityType): string {
  const file = ENTITY_FILE_MAP[entityType];
  if (!file) {
    throw new Error(`No file mapping for entity type: ${entityType}`);
  }
  return file;
}

export function computeNextIds(
  drafts: Draft[],
  maxIds: Map<EntityType, number>,
): Map<EntityType, number> {
  const nextIds = new Map<EntityType, number>();

  for (const draft of drafts) {
    if (draft.type !== "create") continue;

    if (!nextIds.has(draft.entityType)) {
      const maxId = maxIds.get(draft.entityType) ?? 0;
      nextIds.set(draft.entityType, maxId + 1);
    }
  }

  return nextIds;
}

export function computeNextMapEventId(mapEvents: { id: number }[]): number {
  return mapEvents.reduce((max, e) => Math.max(max, e.id), 0) + 1;
}

export function buildWritePlans(
  drafts: Draft[],
  nextIds: Map<EntityType, number>,
  currentPlugins: PluginEntry[],
  mapEventIds: Map<number, number[]>,
): WritePlan[] {
  const plans: WritePlan[] = [];
  const fileOps = new Map<string, fjp.Operation[]>();

  for (const draft of drafts) {
    switch (draft.type) {
      case "create": {
        const file = entityFile(draft.entityType);
        if (!fileOps.has(file)) fileOps.set(file, []);
        const ops = fileOps.get(file);
        if (!ops) throw new Error(`File ${file} not found in fileOps map`);
        ops.push(...buildCreateOps(draft, nextIds));
        break;
      }
      case "update": {
        const file = entityFile(draft.entityType);
        if (!fileOps.has(file)) fileOps.set(file, []);
        const ops = fileOps.get(file);
        if (!ops) throw new Error(`File ${file} not found in fileOps map`);
        ops.push(...buildUpdateOps(draft));
        break;
      }
      case "createMapEvent": {
        const file = `Map${String(draft.mapId).padStart(3, "0")}.json`;
        if (!fileOps.has(file)) fileOps.set(file, []);
        const ops = fileOps.get(file);
        if (!ops) throw new Error(`File ${file} not found in fileOps map`);
        const ids = mapEventIds.get(draft.mapId) ?? [];
        const nextEventId = computeNextMapEventId(ids.map((id) => ({ id })));
        ops.push(...buildCreateMapEventOps(draft, nextEventId));
        // Advance the cursor so the next create on the same map gets the next ID
        mapEventIds.set(draft.mapId, [...ids, nextEventId]);
        break;
      }
      case "updateMapEvent": {
        const file = `Map${String(draft.mapId).padStart(3, "0")}.json`;
        if (!fileOps.has(file)) fileOps.set(file, []);
        const ops = fileOps.get(file);
        if (!ops) throw new Error(`File ${file} not found in fileOps map`);
        ops.push(...buildUpdateMapEventOps(draft));
        break;
      }
      default:
        break;
    }
  }

  for (const [file, ops] of fileOps) {
    plans.push({ kind: "jsonPatch", file, ops });
  }

  const pluginPlans = buildPluginPlans(drafts, currentPlugins);
  plans.push(...pluginPlans);

  return plans;
}

function buildCreateOps(draft: CreateDraft, nextIds: Map<EntityType, number>): fjp.Operation[] {
  const id = nextIds.get(draft.entityType);
  if (id === undefined) {
    throw new Error(`No next ID found for entity type ${draft.entityType}`);
  }
  nextIds.set(draft.entityType, id + 1);
  const entity = { ...draft.fields, id };
  return [{ op: "add", path: `/${id}`, value: entity }];
}

function buildUpdateOps(draft: UpdateDraft): fjp.Operation[] {
  const ops: fjp.Operation[] = [];
  for (const [key, value] of Object.entries(draft.patch)) {
    ops.push({ op: "replace", path: `/${draft.entityId}/${key}`, value });
  }
  return ops;
}

function buildCreateMapEventOps(draft: CreateMapEventDraft, nextEventId: number): fjp.Operation[] {
  const event = { ...draft.event, id: nextEventId };
  return [{ op: "add", path: `/events/${nextEventId}`, value: event }];
}

function buildUpdateMapEventOps(draft: UpdateMapEventDraft): fjp.Operation[] {
  const ops: fjp.Operation[] = [];
  for (const [key, value] of Object.entries(draft.patch)) {
    ops.push({ op: "replace", path: `/events/${draft.eventId}/${key}`, value });
  }
  return ops;
}

function buildPluginPlans(drafts: Draft[], currentPlugins: PluginEntry[]): WritePlan[] {
  const plans: WritePlan[] = [];
  let plugins = [...currentPlugins];

  for (const draft of drafts) {
    if (draft.type === "setPluginParams") {
      plugins = applySetPluginParams(plugins, draft);
    } else if (draft.type === "addPlugin") {
      plugins = applyAddPlugin(plugins, draft);
      plans.push({ kind: "pluginFile", name: draft.name, source: draft.source });
    }
  }

  if (drafts.some((d) => d.type === "setPluginParams" || d.type === "addPlugin")) {
    plans.push({ kind: "pluginConfig", entries: plugins });
  }

  return plans;
}

function applySetPluginParams(plugins: PluginEntry[], draft: SetPluginParamsDraft): PluginEntry[] {
  return plugins.map((p) => {
    if (p.name === draft.pluginName) {
      return { ...p, parameters: { ...p.parameters, ...draft.params } };
    }
    return p;
  });
}

function applyAddPlugin(plugins: PluginEntry[], draft: AddPluginDraft): PluginEntry[] {
  const existing = plugins.find((p) => p.name === draft.name);
  if (existing) {
    throw new Error(`Plugin "${draft.name}" already exists`);
  }
  return [
    ...plugins,
    {
      name: draft.name,
      status: draft.status,
      description: "",
      parameters: draft.params,
    },
  ];
}
