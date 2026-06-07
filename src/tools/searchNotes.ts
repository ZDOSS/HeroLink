import { z } from "zod";
import type { Project } from "../io/project.js";

export const SearchNotesInput = z.object({
  query: z.string(),
});

export const SearchNotesOutput = z.object({
  matches: z.array(
    z.object({
      type: z.string(),
      id: z.number(),
      name: z.string(),
      note: z.string(),
    }),
  ),
});

export function searchNotes(project: Project, input: z.infer<typeof SearchNotesInput>) {
  const q = input.query.toLowerCase();
  const matches: { type: string; id: number; name: string; note: string }[] = [];

  for (const type of project.model.getEntityTypes()) {
    for (const entity of project.model.listEntities(type)) {
      const note = (entity.note as string) ?? "";
      if (note.toLowerCase().includes(q)) {
        matches.push({ type, id: entity.id, name: entity.name, note });
      }
    }
  }

  return { matches };
}
