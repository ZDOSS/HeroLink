import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadProject } from "../../src/io/project.js";
import { modelFromDocuments, type NormalizedModel } from "../../src/model/normalized.js";
import { validateProject } from "../../src/validate/project.js";
import { validateReferences } from "../../src/validate/refs.js";
import { validateExtendedReferences } from "../../src/validate/extended.js";
import { compileCommandList, ConstrainedCommandSchema } from "../../src/schema/commands.js";
import { withTempProject } from "../helpers/withTempProject.js";
const first = (m: NormalizedModel, type: any): any => m.listEntities(type)[0];
const missing = (m: NormalizedModel, type: any) =>
  Math.max(0, ...m.listEntities(type).map((e) => e.id)) + 100;
const clone = (m: NormalizedModel) =>
  modelFromDocuments(
    m.projectDir,
    m.adapter,
    structuredClone(m.documents),
    structuredClone(m.plugins),
  );
const compile = (...commands: any[]) =>
  compileCommandList(commands.map((c) => ConstrainedCommandSchema.parse(c)));
const cases: [string, (m: NormalizedModel) => void, string][] = [
  [
    "skill animation",
    (m) => (first(m, "Skill").animationId = missing(m, "Animation")),
    "animationId",
  ],
  [
    "item animation",
    (m) => (first(m, "Item").animationId = missing(m, "Animation")),
    "animationId",
  ],
  [
    "weapon animation",
    (m) => (first(m, "Weapon").animationId = missing(m, "Animation")),
    "animationId",
  ],
  ["skill type", (m) => (first(m, "Skill").stypeId = m.system.skillTypes.length), "stypeId"],
  ["actor class", (m) => (first(m, "Actor").classId = missing(m, "Class")), "classId"],
  [
    "class learning",
    (m) => (first(m, "Class").learnings = [{ level: 1, skillId: missing(m, "Skill"), note: "" }]),
    "skillId",
  ],
  ["enemy skill", (m) => (first(m, "Enemy").actions[0].skillId = missing(m, "Skill")), "skillId"],
  ...[1, 2, 3].map(
    (kind) =>
      [
        `drop ${kind}`,
        (m: NormalizedModel) =>
          (first(m, "Enemy").dropItems = [{ kind, dataId: 999, denominator: 1 }]),
        "dropItem",
      ] as [string, (m: NormalizedModel) => void, string],
  ),
  [
    "common-event trigger",
    (m) =>
      Object.assign(first(m, "CommonEvent"), { trigger: 1, switchId: m.system.switches.length }),
    "switchId",
  ],
  ["weapon type", (m) => (first(m, "Weapon").wtypeId = m.system.weaponTypes.length), "wtypeId"],
  ["armor type", (m) => (first(m, "Armor").atypeId = m.system.armorTypes.length), "atypeId"],
  ["equipment slot", (m) => (first(m, "Armor").etypeId = m.system.equipTypes.length), "etypeId"],
  ["equipped weapon", (m) => (first(m, "Actor").equips[0] = missing(m, "Weapon")), "equips[0]"],
  [
    "dual-wield weapon",
    (m) => {
      first(m, "Actor").traits.push({ code: 55, dataId: 1, value: 1 });
      first(m, "Actor").equips[1] = missing(m, "Weapon");
    },
    "equips[1]",
  ],
  ["element", (m) => (first(m, "Skill").damage.elementId = m.system.elements.length), "elementId"],
  ...[21, 22, 43, 44].map(
    (code) =>
      [
        `effect ${code}`,
        (m: NormalizedModel) =>
          (first(m, "Item").effects = [{ code, dataId: 999, value1: 1, value2: 0 }]),
        code === 43 ? "effectSkillId" : code === 44 ? "effectCommonEventId" : "effectStateId",
      ] as [string, (m: NormalizedModel) => void, string],
  ),
  [
    "required weapon type",
    (m) => (first(m, "Skill").requiredWtypeId1 = m.system.weaponTypes.length),
    "requiredWtypeId1",
  ],
  ["troop member", (m) => (first(m, "Troop").members[0].enemyId = missing(m, "Enemy")), "enemyId"],
  [
    "troop actor condition",
    (m) =>
      Object.assign(first(m, "Troop").pages[0].conditions, {
        actorValid: true,
        actorId: missing(m, "Actor"),
      }),
    "actorId",
  ],
  [
    "troop switch condition",
    (m) =>
      Object.assign(first(m, "Troop").pages[0].conditions, {
        switchValid: true,
        switchId: m.system.switches.length,
      }),
    "switchId",
  ],
  [
    "troop negative enemy index",
    (m) =>
      Object.assign(first(m, "Troop").pages[0].conditions, { enemyValid: true, enemyIndex: -1 }),
    "enemyIndex",
  ],
  [
    "troop missing enemy index",
    (m) =>
      Object.assign(first(m, "Troop").pages[0].conditions, { enemyValid: true, enemyIndex: 99 }),
    "enemyIndex",
  ],
  ["map parent", (m) => ([...m.mapInfos.values()][0].parentId = 999), "parentId"],
  [
    "encounter troop",
    (m) =>
      ([...m.maps.values()][0].encounterList = [
        { troopId: missing(m, "Troop"), weight: 1, regionSet: [] },
      ]),
    "troopId",
  ],
  [
    "event coordinates",
    (m) => ([...m.maps.values()][0].events.find(Boolean)!.x = -1),
    "coordinates",
  ],
  ...["actor", "item", "switch1", "switch2", "variable"].map(
    (key) =>
      [
        `page ${key}`,
        (m: NormalizedModel) =>
          Object.assign(
            ([...m.maps.values()][0].events.find(Boolean)!.pages as any[])[0].conditions,
            { [key + "Valid"]: true, [key + "Id"]: 999 },
          ),
        key + "Id",
      ] as [string, (m: NormalizedModel) => void, string],
  ),
  ["starting map", (m) => (m.system.startMapId = 999), "startMapId"],
  ["party actor", (m) => (m.system.partyMembers = [missing(m, "Actor")]), "partyMember"],
  ...[11, 13, 14, 31, 32, 41, 42, 43, 44, 51, 52, 53, 54].map(
    (code) =>
      [
        `trait ${code}`,
        (m: NormalizedModel) => (first(m, "Actor").traits = [{ code, dataId: 999, value: 1 }]),
        `trait${code}`,
      ] as [string, (m: NormalizedModel) => void, string],
  ),
];

describe("candidate reference validation", () => {
  it.each(cases)("rejects missing %s references", async (_label, mutate, kind) => {
    await withTempProject("sample-project", async (dir) => {
      const model = loadProject(dir).model;
      mutate(model);
      const result = validateProject(model);
      expect(result.ok).toBe(false);
      expect(result.issues.some((i) => i.refKind === kind)).toBe(true);
    });
  });
  it("accepts existing references, optional zero values, dual wield and plugin-defined traits", async () => {
    await withTempProject("sample-project", async (dir) => {
      const m = loadProject(dir).model;
      const actor = first(m, "Actor"),
        item = first(m, "Item");
      actor.traits = [
        { code: 55, dataId: 1, value: 1 },
        { code: 999, dataId: 999, value: 1 },
        { code: 43, dataId: first(m, "Skill").id, value: 1 },
        { code: 41, dataId: 1, value: 1 },
      ];
      actor.equips = [first(m, "Weapon").id, first(m, "Weapon").id, 0];
      item.damage.elementId = -1;
      item.effects = [
        { code: 21, dataId: 0, value1: 1, value2: 0 },
        { code: 22, dataId: first(m, "State").id, value1: 1, value2: 0 },
        { code: 43, dataId: first(m, "Skill").id, value1: 1, value2: 0 },
        { code: 44, dataId: first(m, "CommonEvent").id, value1: 1, value2: 0 },
      ];
      const page = first(m, "Troop").pages[0];
      Object.assign(page.conditions, {
        enemyValid: true,
        enemyIndex: 0,
        actorValid: true,
        actorId: actor.id,
        switchValid: true,
        switchId: 1,
      });
      expect(validateProject(m)).toEqual({ ok: true, issues: [] });
    });
  });
  it("validates every constrained command reference and imported reference mode", async () => {
    await withTempProject("sample-project", async (dir) => {
      const m = loadProject(dir).model;
      const map = [...m.maps.values()][0];
      const mapId = [...m.maps.keys()][0];
      const animation = JSON.parse(
        readFileSync(".cache/engine-fixtures/mv/Animations.json", "utf8"),
      ).find(Boolean);
      animation.id = (m.documents.get("Animations.json") as unknown[]).length;
      (m.documents.get("Animations.json") as unknown[]).push(animation);
      m.entities.get("Animation")!.set(animation.id, animation);
      const commands = [
        { type: "callCommonEvent", commonEventId: first(m, "CommonEvent").id },
        { type: "changeItems", itemId: first(m, "Item").id, operation: "increase", operand: 1 },
        { type: "changeHp", actorId: first(m, "Actor").id, operation: "decrease", operand: 1 },
        { type: "controlSwitches", startId: 1, endId: 2, value: true },
        { type: "controlVariables", startId: 1, endId: 2, operation: "set", operand: 1 },
        { type: "transferPlayer", mapId, x: 0, y: 0 },
        {
          type: "showAnimation",
          characterId: map.events.find(Boolean)!.id,
          animationId: first(m, "Animation").id,
        },
        { type: "conditionalBranch", conditionType: "switch", switchId: 1, switchValue: true },
        { type: "conditionalBranch", conditionType: "variable", variableId: 1, variableValue: 1 },
        ...[0, 1, 2, 3, 4, 5, 6].map((actorOp) => ({
          type: "conditionalBranch",
          conditionType: "actor",
          actorId: first(m, "Actor").id,
          actorOp,
          actorValue: actorOp === 1 ? "name" : 1,
        })),
        { type: "label", name: "existing" },
        { type: "jumpToLabel", name: "existing" },
      ];
      const event: any = map.events.find(Boolean);
      event.pages[0].list = compile(...commands);
      expect(validateProject(m).ok).toBe(true);
      const list = event.pages[0].list;
      for (const command of list.filter((c: any) =>
        [117, 126, 311, 121, 122, 201, 212, 111, 119].includes(c.code),
      )) {
        const copy = clone(m);
        const target: any = [...copy.maps.values()][0].events.find(Boolean);
        const c = target.pages[0].list[list.indexOf(command)];
        const p = c.parameters;
        if (c.code === 311 || c.code === 111) p[1] = 999;
        else if (c.code === 201 || c.code === 212) p[1] = 999;
        else p[0] = c.code === 119 ? "missing" : 999;
        expect(validateProject(copy).ok, String(c.code)).toBe(false);
      }
      for (const code of [127, 128]) {
        const copy = clone(m);
        const cmd = compile({
          type: "changeItems",
          itemId: 999,
          operation: "increase",
          operand: 1,
        })[0];
        // Simulate imported equipment commands by changing the opcode of a built
        // operand tuple. This is validation input only; no event is authored.
        cmd.code = code;
        first(copy, "CommonEvent").list = [cmd, ...compile()];
        expect(validateProject(copy).ok).toBe(false);
      }
      for (const [x, y] of [
        [-1, 0],
        [map.width, 0],
        [0, -1],
        [0, map.height],
      ]) {
        const copy = clone(m);
        const l = compile({ type: "transferPlayer", mapId, x: 0, y: 0 });
        l[0].parameters[2] = x;
        l[0].parameters[3] = y;
        first(copy, "CommonEvent").list = l;
        expect(validateProject(copy).issues.some((i) => i.refKind === "coordinates")).toBe(true);
      }
      const outside = clone(m);
      first(outside, "CommonEvent").list = compile({
        type: "showAnimation",
        characterId: 1,
        animationId: first(m, "Animation").id,
      });
      expect(validateProject(outside).issues.some((i) => i.refKind === "characterId")).toBe(true);
      for (const actorOp of [2, 3, 4, 5, 6]) {
        const copy = clone(m);
        first(copy, "CommonEvent").list = compile({
          type: "conditionalBranch",
          conditionType: "actor",
          actorId: first(m, "Actor").id,
          actorOp,
          actorValue: 999,
        });
        expect(validateProject(copy).issues.some((i) => i.refKind === "actorConditionId")).toBe(
          true,
        );
      }
      const imported = clone(m);
      const l = compile({
        type: "conditionalBranch",
        conditionType: "variable",
        variableId: 1,
        variableValue: 1,
      });
      l[0].parameters[2] = 1;
      l[0].parameters[3] = 999;
      first(imported, "CommonEvent").list = l;
      expect(validateProject(imported).issues.some((i) => i.refKind === "operandVariableId")).toBe(
        true,
      );
    });
  });
  it("reports schema errors without attempting unsafe reference traversal", async () => {
    await withTempProject("sample-project", async (dir) => {
      const m = loadProject(dir).model;
      first(m, "Item").damage = null;
      expect(validateProject(m).issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ refKind: "schema" })]),
      );
    });
  });
  it("reports malformed notes, plugin values and incomplete legacy reference records", async () => {
    await withTempProject("sample-project", async (dir) => {
      const m = loadProject(dir).model;
      first(m, "Item").note = "< >";
      m.plugins[0].parameters = { bad: 42 };
      first(m, "Enemy").actions = [{ skillId: 0 }];
      first(m, "Enemy").dropItems = [{ kind: 1, dataId: 0 }];
      first(m, "Class").learnings = [{ skillId: 0 }];
      first(m, "Actor").classId = 0;
      first(m, "Skill").animationId = 1;
      first(m, "Skill").stypeId = 999;
      first(m, "CommonEvent").switchId = 999;
      const kinds = validateReferences(m).map((i) => i.refKind);
      expect(kinds).toContain("malformedNote");
      expect(kinds).toContain("pluginParamType");
      expect(kinds).toContain("switchId");
      delete first(m, "Enemy").actions;
      delete first(m, "Enemy").dropItems;
      delete first(m, "Class").learnings;
      delete m.system.switches;
      delete m.system.skillTypes;
      delete first(m, "Skill").stypeId;
      expect(validateReferences(m).some((i) => i.refKind === "pluginParamType")).toBe(true);
      m.documents.set("Items.json", null);
      expect(validateReferences(m).some((i) => i.refKind === "malformedNote")).toBe(true);
      m.documents.set("Items.json", [null, null, { id: "bad" }]);
      expect(validateReferences(m).some((i) => i.refKind === "malformedNote")).toBe(true);
    });
  });
});
