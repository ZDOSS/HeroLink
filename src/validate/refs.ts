import type { RefIssue } from "../errors.js";
import type { EntityType, NormalizedModel } from "../model/normalized.js";

export function validateReferences(model: NormalizedModel): RefIssue[] {
  const issues: RefIssue[] = [];

  validateSkillRefs(model, issues);
  validateItemRefs(model, issues);
  validateActorRefs(model, issues);
  validateClassRefs(model, issues);
  validateEnemyRefs(model, issues);
  validateCommonEventRefs(model, issues);
  validateArrayInvariants(model, issues);
  validateNotes(model, issues);
  validatePluginParams(model, issues);

  return issues;
}

function validateSkillRefs(model: NormalizedModel, issues: RefIssue[]) {
  for (const skill of model.listEntities("Skill")) {
    const s = skill as Record<string, unknown>;

    if (typeof s.animationId === "number" && s.animationId > 0) {
      if (!model.getEntity("Animation", s.animationId)) {
        issues.push({
          severity: "error",
          location: `Skill:${skill.id}`,
          message: `animationId ${s.animationId} references non-existent Animation`,
          refKind: "animationId",
        });
      }
    }

    if (typeof s.stypeId === "number") {
      const skillTypes = model.system.skillTypes ?? [];
      if (s.stypeId >= skillTypes.length) {
        issues.push({
          severity: "error",
          location: `Skill:${skill.id}`,
          message: `stypeId ${s.stypeId} out of range (max ${skillTypes.length - 1})`,
          refKind: "stypeId",
        });
      }
    }
  }
}

function validateItemRefs(model: NormalizedModel, issues: RefIssue[]) {
  for (const item of model.listEntities("Item")) {
    const i = item as Record<string, unknown>;

    if (typeof i.animationId === "number" && i.animationId > 0) {
      if (!model.getEntity("Animation", i.animationId)) {
        issues.push({
          severity: "error",
          location: `Item:${item.id}`,
          message: `animationId ${i.animationId} references non-existent Animation`,
          refKind: "animationId",
        });
      }
    }
  }
}

function validateActorRefs(model: NormalizedModel, issues: RefIssue[]) {
  for (const actor of model.listEntities("Actor")) {
    const a = actor as Record<string, unknown>;

    if (typeof a.classId === "number" && a.classId > 0) {
      if (!model.getEntity("Class", a.classId)) {
        issues.push({
          severity: "error",
          location: `Actor:${actor.id}`,
          message: `classId ${a.classId} references non-existent Class`,
          refKind: "classId",
        });
      }
    }
  }
}

function validateClassRefs(model: NormalizedModel, issues: RefIssue[]) {
  for (const cls of model.listEntities("Class")) {
    const c = cls as Record<string, unknown>;
    const learnings = (c.learnings as Array<Record<string, unknown>>) ?? [];

    for (const learning of learnings) {
      if (typeof learning.skillId === "number" && learning.skillId > 0) {
        if (!model.getEntity("Skill", learning.skillId)) {
          issues.push({
            severity: "error",
            location: `Class:${cls.id}:learning`,
            message: `skillId ${learning.skillId} references non-existent Skill`,
            refKind: "skillId",
          });
        }
      }
    }
  }
}

function validateEnemyRefs(model: NormalizedModel, issues: RefIssue[]) {
  for (const enemy of model.listEntities("Enemy")) {
    const e = enemy as Record<string, unknown>;
    const actions = (e.actions as Array<Record<string, unknown>>) ?? [];

    for (const action of actions) {
      if (typeof action.skillId === "number" && action.skillId > 0) {
        if (!model.getEntity("Skill", action.skillId)) {
          issues.push({
            severity: "error",
            location: `Enemy:${enemy.id}:action`,
            message: `skillId ${action.skillId} references non-existent Skill`,
            refKind: "skillId",
          });
        }
      }
    }

    const dropItems = (e.dropItems as Array<Record<string, unknown>>) ?? [];
    for (const drop of dropItems) {
      if (
        typeof drop.kind === "number" &&
        drop.kind > 0 &&
        typeof drop.dataId === "number" &&
        drop.dataId > 0
      ) {
        const entityType = drop.kind === 1 ? "Item" : drop.kind === 2 ? "Weapon" : "Armor";
        if (!model.getEntity(entityType as EntityType, drop.dataId)) {
          issues.push({
            severity: "error",
            location: `Enemy:${enemy.id}:drop`,
            message: `dropItem dataId ${drop.dataId} references non-existent ${entityType}`,
            refKind: "dropItem",
          });
        }
      }
    }
  }
}

function validateCommonEventRefs(model: NormalizedModel, issues: RefIssue[]) {
  for (const ce of model.listEntities("CommonEvent")) {
    const c = ce as Record<string, unknown>;

    if (typeof c.switchId === "number" && c.switchId > 0) {
      const switches = model.system.switches ?? [];
      if (c.switchId >= switches.length) {
        issues.push({
          severity: "warn",
          location: `CommonEvent:${ce.id}`,
          message: `switchId ${c.switchId} out of range (max ${switches.length - 1})`,
          refKind: "switchId",
        });
      }
    }
  }
}

const ENTITY_FILES: Record<string, string> = {
  Actor: "Actors.json",
  Class: "Classes.json",
  Skill: "Skills.json",
  Item: "Items.json",
  Weapon: "Weapons.json",
  Armor: "Armors.json",
  Enemy: "Enemies.json",
  Troop: "Troops.json",
  State: "States.json",
  CommonEvent: "CommonEvents.json",
  Animation: "Animations.json",
  Tileset: "Tilesets.json",
  MapInfo: "MapInfos.json",
};

function validateArrayInvariants(model: NormalizedModel, issues: RefIssue[]) {
  const arrays = [
    ...Object.entries(ENTITY_FILES).map(
      ([type, file]) => [type, model.documents.get(file)] as const,
    ),
    ...[...model.maps].map(([id, map]) => [`Map:${id}:Event`, map.events] as const),
  ];
  for (const [type, value] of arrays) {
    if (!Array.isArray(value)) continue;
    const data = value as Array<Record<string, unknown> | null>;
    if (data[0] !== null)
      issues.push({
        severity: "error",
        location: `${type}:0`,
        message: "Index zero must be null",
        refKind: "idIndexMismatch",
      });
    const ids = new Set<number>();
    for (let i = 1; i < data.length; i++) {
      const record = data[i];
      if (!record || typeof record.id !== "number") continue;
      const id = record.id;
      if (id !== i)
        issues.push({
          severity: "error",
          location: `${type}:${i}`,
          message: `id ${id} does not match array index ${i}`,
          refKind: "idIndexMismatch",
        });
      if (ids.has(id))
        issues.push({
          severity: "error",
          location: `${type}:${id}`,
          message: `Duplicate id ${id} in ${type}`,
          refKind: "duplicateId",
        });
      ids.add(id);
    }
  }
}

function validateNotes(model: NormalizedModel, issues: RefIssue[]) {
  for (const type of model.getEntityTypes()) {
    for (const entity of model.listEntities(type)) {
      const note = (entity as Record<string, unknown>).note;
      if (typeof note !== "string" || note.length === 0) continue;

      const openCount = (note.match(/</g) ?? []).length;
      const closeCount = (note.match(/>/g) ?? []).length;
      if (openCount !== closeCount) {
        issues.push({
          severity: "warn",
          location: `${type}:${entity.id}`,
          message: "Malformed note: mismatched angle brackets",
          refKind: "malformedNote",
        });
        continue;
      }

      const regex = /<([^<>]*?)>/g;
      for (const match of note.matchAll(regex)) {
        const inner = match[1].trim();
        if (inner === "") {
          issues.push({
            severity: "warn",
            location: `${type}:${entity.id}`,
            message: `Malformed note tag: ${match[0]}`,
            refKind: "malformedNote",
          });
        }
      }
    }
  }
}

function validatePluginParams(model: NormalizedModel, issues: RefIssue[]) {
  for (const plugin of model.plugins) {
    for (const [key, value] of Object.entries(plugin.parameters)) {
      if (typeof value !== "string") {
        issues.push({
          severity: "error",
          location: `Plugin:${plugin.name}`,
          message: `Parameter "${key}" is not a string (got ${typeof value})`,
          refKind: "pluginParamType",
        });
      }
    }
  }
}
