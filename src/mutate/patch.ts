import type fjp from "fast-json-patch";
import type { EntityType } from "../model/normalized.js";
import type { CreateDraft, Draft, UpdateDraft } from "./staging.js";

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

export interface FilePatch {
  file: string;
  ops: fjp.Operation[];
}

export function entityFile(entityType: EntityType): string {
  return ENTITY_FILE_MAP[entityType];
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

export function buildPatches(drafts: Draft[], nextIds: Map<EntityType, number>): FilePatch[] {
  const fileOps = new Map<string, fjp.Operation[]>();

  for (const draft of drafts) {
    const file = entityFile(draft.entityType);
    if (!fileOps.has(file)) {
      fileOps.set(file, []);
    }
    const ops = fileOps.get(file);
    if (!ops) {
      throw new Error(`File ${file} not found in fileOps map`);
    }

    if (draft.type === "create") {
      ops.push(...buildCreateOps(draft, nextIds));
    } else {
      ops.push(...buildUpdateOps(draft));
    }
  }

  return Array.from(fileOps.entries()).map(([file, ops]) => ({ file, ops }));
}

function buildCreateOps(draft: CreateDraft, nextIds: Map<EntityType, number>): fjp.Operation[] {
  const id = nextIds.get(draft.entityType);
  if (id === undefined) {
    throw new Error(`No next ID found for entity type ${draft.entityType}`);
  }
  // Advance the cursor so the next create of the same type gets the next ID.
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
