import { z } from "zod";
import { ValidationError } from "../errors.js";
import type { EntityType } from "../model/normalized.js";
import * as entities from "./entities.js";

export const PluginName = z
  .string()
  .min(1)
  .max(128)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: reject filesystem control characters
  .regex(/^[^/\\\x00-\x1f<>:"|?*]+$/)
  .refine(
    (name) =>
      !name.includes("..") &&
      !/[. ]$/.test(name) &&
      !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name),
    "Use a safe plugin basename without an extension or path",
  );
export const EntityTypeSchema = z.enum([
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
]);

export const entitySchemas: Partial<Record<EntityType, z.AnyZodObject>> = {
  Actor: entities.ActorSchema,
  Class: entities.ClassSchema,
  Skill: entities.SkillSchema,
  Item: entities.ItemSchema,
  Weapon: entities.WeaponSchema,
  Armor: entities.ArmorSchema,
  Enemy: entities.EnemySchema,
  Troop: entities.TroopSchema,
  State: entities.StateSchema,
  CommonEvent: entities.CommonEventSchema,
};

export function invalid(message: string): never {
  throw new ValidationError([{ code: "custom", path: [], message }]);
}

export function assertSafeKeys(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) invalid(`Unsafe field: ${key}`);
    assertSafeKeys(child);
  }
}

export function validateEntityFields(
  type: EntityType,
  fields: Record<string, unknown>,
  partial: boolean,
  publicInput = false,
): void {
  assertSafeKeys(fields);
  const schema = entitySchemas[type];
  if (!schema) invalid(`Authoring ${type} is not supported`);
  if ("id" in fields) invalid("IDs are immutable and allocated by HeroLink");
  if (publicInput && ("list" in fields || "pages" in fields))
    invalid("Use the constrained event command builder to author event lists or pages");
  const writable = schema.omit({ id: true });
  const result = (partial ? writable.partial() : writable).strict().safeParse(fields);
  if (!result.success) throw new ValidationError(result.error.issues);
}
