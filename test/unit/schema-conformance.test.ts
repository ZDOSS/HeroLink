import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ItemSchema,
  SkillSchema,
  WeaponSchema,
  ArmorSchema,
  StateSchema,
  EnemySchema,
  ActorSchema,
  ClassSchema,
  CommonEventSchema,
  TroopSchema,
  MapInfoSchema,
  MapEventSchema,
} from "../../src/schema/entities.js";

const SAMPLE_DIR = join(process.cwd(), "test", "fixtures", "sample-project");

function loadArray(file: string): unknown[] {
  const content = readFileSync(join(SAMPLE_DIR, "data", file), "utf-8");
  return JSON.parse(content);
}

describe("schema conformance", () => {
  it("all Items parse against ItemSchema", () => {
    const data = loadArray("Items.json");
    for (let i = 1; i < data.length; i++) {
      if (data[i]) {
        const result = ItemSchema.safeParse(data[i]);
        expect(result.success, `Item ${i}: ${JSON.stringify(result.error)}`).toBe(true);
      }
    }
  });

  it("all Skills parse against SkillSchema", () => {
    const data = loadArray("Skills.json");
    for (let i = 1; i < data.length; i++) {
      if (data[i]) {
        const result = SkillSchema.safeParse(data[i]);
        expect(result.success, `Skill ${i}: ${JSON.stringify(result.error)}`).toBe(true);
      }
    }
  });

  it("all Weapons parse against WeaponSchema", () => {
    const data = loadArray("Weapons.json");
    for (let i = 1; i < data.length; i++) {
      if (data[i]) {
        const result = WeaponSchema.safeParse(data[i]);
        expect(result.success, `Weapon ${i}: ${JSON.stringify(result.error)}`).toBe(true);
      }
    }
  });

  it("all Armors parse against ArmorSchema", () => {
    const data = loadArray("Armors.json");
    for (let i = 1; i < data.length; i++) {
      if (data[i]) {
        const result = ArmorSchema.safeParse(data[i]);
        expect(result.success, `Armor ${i}: ${JSON.stringify(result.error)}`).toBe(true);
      }
    }
  });

  it("all States parse against StateSchema", () => {
    const data = loadArray("States.json");
    for (let i = 1; i < data.length; i++) {
      if (data[i]) {
        const result = StateSchema.safeParse(data[i]);
        expect(result.success, `State ${i}: ${JSON.stringify(result.error)}`).toBe(true);
      }
    }
  });

  it("all Enemies parse against EnemySchema", () => {
    const data = loadArray("Enemies.json");
    for (let i = 1; i < data.length; i++) {
      if (data[i]) {
        const result = EnemySchema.safeParse(data[i]);
        expect(result.success, `Enemy ${i}: ${JSON.stringify(result.error)}`).toBe(true);
      }
    }
  });

  it("all Actors parse against ActorSchema", () => {
    const data = loadArray("Actors.json");
    for (let i = 1; i < data.length; i++) {
      if (data[i]) {
        const result = ActorSchema.safeParse(data[i]);
        expect(result.success, `Actor ${i}: ${JSON.stringify(result.error)}`).toBe(true);
      }
    }
  });

  it("all Classes parse against ClassSchema", () => {
    const data = loadArray("Classes.json");
    for (let i = 1; i < data.length; i++) {
      if (data[i]) {
        const result = ClassSchema.safeParse(data[i]);
        expect(result.success, `Class ${i}: ${JSON.stringify(result.error)}`).toBe(true);
      }
    }
  });

  it("all CommonEvents parse against CommonEventSchema", () => {
    const data = loadArray("CommonEvents.json");
    for (let i = 1; i < data.length; i++) {
      if (data[i]) {
        const result = CommonEventSchema.safeParse(data[i]);
        expect(result.success, `CommonEvent ${i}: ${JSON.stringify(result.error)}`).toBe(true);
      }
    }
  });

  it("all Troops parse against TroopSchema", () => {
    const data = loadArray("Troops.json");
    for (let i = 1; i < data.length; i++) {
      if (data[i]) {
        const result = TroopSchema.safeParse(data[i]);
        expect(result.success, `Troop ${i}: ${JSON.stringify(result.error)}`).toBe(true);
      }
    }
  });

  it("all MapInfos parse against MapInfoSchema", () => {
    const data = loadArray("MapInfos.json");
    for (let i = 1; i < data.length; i++) {
      if (data[i]) {
        const result = MapInfoSchema.safeParse(data[i]);
        expect(result.success, `MapInfo ${i}: ${JSON.stringify(result.error)}`).toBe(true);
      }
    }
  });

  it("all MapEvents parse against MapEventSchema", () => {
    const content = readFileSync(join(SAMPLE_DIR, "data", "Map001.json"), "utf-8");
    const map = JSON.parse(content);
    for (let i = 1; i < map.events.length; i++) {
      if (map.events[i]) {
        const result = MapEventSchema.safeParse(map.events[i]);
        expect(result.success, `MapEvent ${i}: ${JSON.stringify(result.error)}`).toBe(true);
      }
    }
  });
});
