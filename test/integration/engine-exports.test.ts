import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { MvAdapter } from "../../src/engine/mv.js";
import { MzAdapter } from "../../src/engine/mz.js";
import { entitySchemas, validateEntityFields } from "../../src/schema/safety.js";
import { MapEventSchema } from "../../src/schema/entities.js";
import { compileCommandList, ConstrainedCommandSchema } from "../../src/schema/commands.js";

const cache = join(process.cwd(), ".cache/engine-fixtures");
const read = (engine: string, file: string) =>
  JSON.parse(readFileSync(join(cache, engine, file + ".json"), "utf8"));
describe.each(["mv", "mz"])("real %s editor exports", (engine) => {
  it.each(["Actor", "Skill", "State", "Enemy", "Weapon"] as const)(
    "preserves every standard %s field during authoring",
    (type) => {
      for (const record of read(engine, type === "Enemy" ? "Enemies" : type + "s").filter(
        Boolean,
      )) {
        expect(
          entitySchemas[type]!.strict().safeParse(record).success,
          JSON.stringify(record),
        ).toBe(true);
        const { id, ...fields } = record;
        expect(() => validateEntityFields(type, fields, false)).not.toThrow();
      }
    },
  );
  it("recognizes its actual animation format and map move routes", () => {
    const adapter = engine === "mv" ? new MvAdapter() : new MzAdapter();
    for (const record of read(engine, "Animations").filter(Boolean))
      expect(adapter.animationSchema.safeParse(record).success, record.name).toBe(true);
    for (const event of read(engine, "Map001").events.filter(Boolean))
      expect(MapEventSchema.safeParse(event).success, event.name).toBe(true);
  });
});

it("executes HP and nested actor/variable branches with the official MV interpreter", () => {
  // Only this pinned MIT engine source is executed. Project notes, formulas and
  // event scripts are never evaluated; the list comes from the constrained DSL.
  const values = new Map([[1, 4]]);
  const switches = new Map();
  const actor = {
    hp: 100,
    isAlive: () => true,
    gainHp(n: number) {
      this.hp += n;
    },
    isDead: () => false,
    name: () => "Hero",
  };
  const player = { requestAnimation: (id: number) => animations.push(id) };
  const animations: number[] = [];
  const context = vm.createContext({
    $dataAnimations: read("mv", "Animations"),
    ImageManager: { requestAnimation: () => {} },
    $gameMap: { mapId: () => 1 },
    $gameParty: {
      inBattle: () => false,
      members: () => Object.assign([actor], { contains: (value: unknown) => value === actor }),
    },
    $gameActors: { actor: () => actor },
    $gameVariables: {
      value: (id: number) => values.get(id),
      setValue: (id: number, v: number) => values.set(id, v),
    },
    $gameSwitches: {
      value: (id: number) => switches.get(id),
      setValue: (id: number, v: boolean) => switches.set(id, v),
    },
    $gamePlayer: player,
  });
  vm.runInContext(readFileSync(join(cache, "Game_Interpreter.js"), "utf8"), context);
  const Interpreter = context.Game_Interpreter as new () => any;
  const runtime = new Interpreter();
  const commands = [
    {
      type: "conditionalBranch",
      conditionType: "variable",
      variableId: 1,
      variableValue: 3,
      variableOp: 3,
      then: [
        {
          type: "conditionalBranch",
          conditionType: "actor",
          actorId: 1,
          actorOp: 0,
          then: [{ type: "changeHp", actorId: 1, operation: "decrease", operand: 25 }],
          else: [{ type: "changeHp", actorId: 1, operation: "increase", operand: 999 }],
        },
      ],
      else: [{ type: "changeHp", actorId: 1, operation: "increase", operand: 1000 }],
    },
    { type: "showAnimation", characterId: -1, animationId: 1 },
  ];
  runtime.setup(compileCommandList(commands.map((c) => ConstrainedCommandSchema.parse(c))), 0);
  for (let steps = 0; runtime.currentCommand() && steps < 100; steps++) runtime.executeCommand();
  expect(actor.hp).toBe(75);
  expect(animations).toEqual([1]);
  values.set(1, 2);
  runtime.setup(compileCommandList(commands.map((c) => ConstrainedCommandSchema.parse(c))), 0);
  for (let steps = 0; runtime.currentCommand() && steps < 100; steps++) runtime.executeCommand();
  expect(actor.hp).toBe(1075);
});
