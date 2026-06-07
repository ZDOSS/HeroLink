import { z } from "zod";
import type { Project } from "../io/project.js";
import type { EntityType } from "../model/normalized.js";

export const GetEntityInput = z.object({
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
  id: z.number().int().positive(),
});

export const GetEntityOutput = z.object({
  entity: z.record(z.string(), z.unknown()),
  meta: z.record(z.string(), z.unknown()),
});

function parseNote(note: string): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  const regex = /<([^<>:]+)(:?)([^>]*)>/g;
  for (const match of note.matchAll(regex)) {
    const key = match[1].trim();
    if (match[2] === ":") {
      meta[key] = match[3].trim();
    } else {
      meta[key] = true;
    }
  }
  return meta;
}

export function getEntity(project: Project, input: z.infer<typeof GetEntityInput>) {
  const entity = project.model.getEntity(input.type as EntityType, input.id);
  if (!entity) {
    throw new Error(`${input.type} with id ${input.id} not found`);
  }
  const note = (entity.note as string) ?? "";
  return {
    entity: entity as Record<string, unknown>,
    meta: parseNote(note),
  };
}
