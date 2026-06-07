import { z } from "zod";
import type { Project } from "../io/project.js";
import type { EntityType } from "../model/normalized.js";

export const ListEntitiesInput = z.object({
  type: z.enum([
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
  ]),
  query: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export const ListEntitiesOutput = z.object({
  items: z.array(
    z
      .object({
        id: z.number(),
        name: z.string(),
      })
      .passthrough(),
  ),
  total: z.number(),
});

export function listEntities(project: Project, input: z.infer<typeof ListEntitiesInput>) {
  let entities = project.model.listEntities(input.type as EntityType);

  if (input.query) {
    const q = input.query.toLowerCase();
    entities = entities.filter((e) => (e.name as string).toLowerCase().includes(q));
  }

  const total = entities.length;
  const offset = input.offset ?? 0;
  const limit = input.limit ?? total;
  const items = entities.slice(offset, offset + limit);

  return { items, total };
}
