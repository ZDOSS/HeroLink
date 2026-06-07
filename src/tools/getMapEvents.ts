import { z } from "zod";
import type { Project } from "../io/project.js";

export const GetMapEventsInput = z.object({
  mapId: z.number().int().positive(),
});

export const GetMapEventsOutput = z.object({
  events: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      x: z.number(),
      y: z.number(),
      pageCount: z.number(),
    }),
  ),
});

export function getMapEvents(project: Project, input: z.infer<typeof GetMapEventsInput>) {
  const events = project.model.getMapEvents(input.mapId).map((e) => ({
    id: e.id,
    name: e.name,
    x: e.x,
    y: e.y,
    pageCount: e.pages.length,
  }));
  return { events };
}
