import type { RefIssue } from "../errors.js";
import type { EntityType, NormalizedModel } from "../model/normalized.js";
import type { EventCommand, MapEventPage, TroopPage } from "../schema/entities.js";

// These are positional engine references, never evaluated script/formula text.
export function validateExtendedReferences(model: NormalizedModel): RefIssue[] {
  const issues: RefIssue[] = [];
  const fail = (location: string, field: string, message: string) =>
    issues.push({ severity: "error", location, refKind: field, message });
  const ref = (
    type: EntityType,
    id: unknown,
    location: string,
    field: string,
    optional = false,
  ) => {
    if (optional && id === 0) return;
    if (typeof id !== "number" || !Number.isInteger(id) || id <= 0 || !model.getEntity(type, id))
      fail(location, field, `${field} ${id} references missing ${type}`);
  };
  const systemRef = (
    table: string,
    id: unknown,
    location: string,
    field: string,
    optional = false,
  ) => {
    if (optional && id === 0) return;
    const values = model.system[table];
    if (
      !Array.isArray(values) ||
      typeof id !== "number" ||
      !Number.isInteger(id) ||
      id <= 0 ||
      id >= values.length
    )
      fail(location, field, `${field} ${id} is outside System.${table}`);
  };
  const mapRef = (id: unknown, location: string, field: string, optional = false) => {
    if (optional && id === 0) return;
    if (typeof id !== "number" || !model.maps.has(id))
      fail(location, field, `${field} ${id} references a missing Map`);
  };
  const commands = (list: EventCommand[], location: string, mapId?: number) => {
    const labels = new Set(list.filter((c) => c.code === 118).map((c) => c.parameters[0]));
    for (const command of list) {
      const p = command.parameters;
      const loc = `${location}:command${command.code}`;
      if (command.code === 117) ref("CommonEvent", p[0], loc, "commonEventId");
      if (command.code === 126) ref("Item", p[0], loc, "itemId");
      if (command.code === 127) ref("Weapon", p[0], loc, "weaponId");
      if (command.code === 128) ref("Armor", p[0], loc, "armorId");
      if (command.code === 311 && p[0] === 0) ref("Actor", p[1], loc, "actorId", true);
      if (command.code === 121 || command.code === 122) {
        for (const id of p.slice(0, 2))
          systemRef(command.code === 121 ? "switches" : "variables", id, loc, "range");
        if (Number(p[0]) > Number(p[1])) fail(loc, "range", "Range end is before start");
      }
      if (command.code === 201 && p[0] === 0) {
        mapRef(p[1], loc, "mapId");
        const map = model.maps.get(Number(p[1]));
        if (
          map &&
          (Number(p[2]) < 0 ||
            Number(p[2]) >= map.width ||
            Number(p[3]) < 0 ||
            Number(p[3]) >= map.height)
        )
          fail(loc, "coordinates", "Transfer destination is outside the map");
      }
      if (command.code === 212) {
        ref("Animation", p[1], loc, "animationId");
        if (
          Number(p[0]) > 0 &&
          (mapId === undefined || !model.getMapEvents(mapId).some((e) => e.id === p[0]))
        )
          fail(loc, "characterId", "Positive character IDs require an existing event on this map");
      }
      if (command.code === 111) {
        if (p[0] === 0) systemRef("switches", p[1], loc, "switchId");
        if (p[0] === 1) {
          systemRef("variables", p[1], loc, "variableId");
          if (p[2] === 1) systemRef("variables", p[3], loc, "operandVariableId");
        }
        if (p[0] === 4) {
          ref("Actor", p[1], loc, "actorId");
          const types: Record<number, EntityType> = {
            2: "Class",
            3: "Skill",
            4: "Weapon",
            5: "Armor",
            6: "State",
          };
          if (types[Number(p[2])]) ref(types[Number(p[2])], p[3], loc, "actorConditionId");
        }
      }
      if (command.code === 119 && !labels.has(p[0])) fail(loc, "label", `Missing label ${p[0]}`);
    }
  };
  for (const type of model.getEntityTypes())
    for (const entity of model.listEntities(type)) {
      const loc = `${type}:${entity.id}`;
      // MV Game_BattlerBase TRAIT_* constants. Unknown plugin trait codes remain
      // opaque, but engine-owned references must resolve before writing.
      const traitEntities: Record<number, EntityType> = {
        13: "State",
        14: "State",
        32: "State",
        43: "Skill",
        44: "Skill",
      };
      const traitTables: Record<number, string> = {
        11: "elements",
        31: "elements",
        41: "skillTypes",
        42: "skillTypes",
        51: "weaponTypes",
        52: "armorTypes",
        53: "equipTypes",
        54: "equipTypes",
      };
      for (const trait of (entity.traits ?? []) as { code: number; dataId: number }[]) {
        if (traitEntities[trait.code])
          ref(traitEntities[trait.code], trait.dataId, loc, `trait${trait.code}`);
        if (traitTables[trait.code])
          systemRef(traitTables[trait.code], trait.dataId, loc, `trait${trait.code}`);
      }
      if (type === "Weapon" || type === "Armor") {
        systemRef("equipTypes", entity.etypeId, loc, "etypeId");
        systemRef(
          type === "Weapon" ? "weaponTypes" : "armorTypes",
          type === "Weapon" ? entity.wtypeId : entity.atypeId,
          loc,
          type === "Weapon" ? "wtypeId" : "atypeId",
        );
        if (type === "Weapon" && Number(entity.animationId) > 0)
          ref("Animation", entity.animationId, loc, "animationId");
      }
      if (type === "Actor") {
        ref("Class", entity.classId, loc, "classId");
        const cls = model.getEntity("Class", Number(entity.classId));
        const dualWield = [
          ...(entity.traits as { code: number; dataId: number }[]),
          ...((cls?.traits ?? []) as { code: number; dataId: number }[]),
        ].some((t) => t.code === 55 && t.dataId === 1);
        (entity.equips as number[]).forEach((id, index) =>
          ref(
            index === 0 || (index === 1 && dualWield) ? "Weapon" : "Armor",
            id,
            loc,
            `equips[${index}]`,
            true,
          ),
        );
      }
      if (type === "Item" || type === "Skill") {
        const damage = entity.damage as { elementId: number };
        if (damage.elementId !== -1)
          systemRef("elements", damage.elementId, loc, "elementId", true);
        for (const effect of entity.effects as { code: number; dataId: number }[]) {
          if (effect.code === 21 || effect.code === 22)
            ref("State", effect.dataId, loc, "effectStateId", effect.code === 21);
          if (effect.code === 43) ref("Skill", effect.dataId, loc, "effectSkillId");
          if (effect.code === 44) ref("CommonEvent", effect.dataId, loc, "effectCommonEventId");
        }
        if (type === "Skill")
          for (const key of ["requiredWtypeId1", "requiredWtypeId2"])
            systemRef("weaponTypes", entity[key], loc, key, true);
      }
      if (type === "CommonEvent") {
        if (Number(entity.trigger) > 0) systemRef("switches", entity.switchId, loc, "switchId");
        commands(entity.list as EventCommand[], loc);
      }
      if (type === "Troop") {
        for (const member of entity.members as { enemyId: number }[])
          ref("Enemy", member.enemyId, loc, "enemyId");
        for (const page of entity.pages as TroopPage[]) {
          if (page.conditions.actorValid) ref("Actor", page.conditions.actorId, loc, "actorId");
          if (page.conditions.switchValid)
            systemRef("switches", page.conditions.switchId, loc, "switchId");
          if (
            page.conditions.enemyValid &&
            (page.conditions.enemyIndex < 0 ||
              page.conditions.enemyIndex >= (entity.members as unknown[]).length)
          )
            fail(loc, "enemyIndex", "Troop page references a missing member");
          commands(page.list, loc);
        }
      }
    }
  for (const [id, info] of model.mapInfos) mapRef(info.parentId, `MapInfo:${id}`, "parentId", true);
  for (const [id, map] of model.maps) {
    const loc = `Map:${id}`;
    // An empty Tilesets database occurs in the deliberately minimal legacy fixture.
    // It is an error in a playable project and must be visible before apply.
    ref("Tileset", map.tilesetId, loc, "tilesetId");
    for (const encounter of (map.encounterList ?? []) as { troopId: number }[])
      ref("Troop", encounter.troopId, loc, "troopId");
    for (const event of map.events)
      if (event) {
        if (event.x < 0 || event.y < 0 || event.x >= map.width || event.y >= map.height)
          fail(loc, "coordinates", `Event ${event.id} is outside the map`);
        for (const page of event.pages as MapEventPage[]) {
          const c = page.conditions;
          if (c.actorValid) ref("Actor", c.actorId, loc, "actorId");
          if (c.itemValid) ref("Item", c.itemId, loc, "itemId");
          if (c.switch1Valid) systemRef("switches", c.switch1Id, loc, "switch1Id");
          if (c.switch2Valid) systemRef("switches", c.switch2Id, loc, "switch2Id");
          if (c.variableValid) systemRef("variables", c.variableId, loc, "variableId");
          commands(page.list, `${loc}:Event:${event.id}`, id);
        }
      }
  }
  mapRef(model.system.startMapId, "System", "startMapId");
  const startMap = model.maps.get(model.system.startMapId);
  if (
    startMap &&
    (Number(model.system.startX) >= startMap.width ||
      Number(model.system.startY) >= startMap.height)
  )
    fail("System", "coordinates", "Player starting position is outside the map");
  for (const id of model.system.partyMembers) ref("Actor", id, "System", "partyMember");
  return issues;
}
