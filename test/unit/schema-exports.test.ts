import { describe, it, expect } from "vitest";
import * as schemas from "../../src/schema/index.js";

describe("schema exports", () => {
  it("exports all entity schemas", () => {
    expect(schemas.ItemSchema).toBeDefined();
    expect(schemas.SkillSchema).toBeDefined();
    expect(schemas.WeaponSchema).toBeDefined();
    expect(schemas.ArmorSchema).toBeDefined();
    expect(schemas.StateSchema).toBeDefined();
    expect(schemas.EnemySchema).toBeDefined();
    expect(schemas.ActorSchema).toBeDefined();
    expect(schemas.ClassSchema).toBeDefined();
    expect(schemas.CommonEventSchema).toBeDefined();
    expect(schemas.TroopSchema).toBeDefined();
    expect(schemas.MapInfoSchema).toBeDefined();
    expect(schemas.MapEventSchema).toBeDefined();
    expect(schemas.PluginEntrySchema).toBeDefined();
    expect(schemas.DamageSchema).toBeDefined();
    expect(schemas.EffectSchema).toBeDefined();
    expect(schemas.TraitSchema).toBeDefined();
    expect(schemas.EventCommandSchema).toBeDefined();
  });
});
