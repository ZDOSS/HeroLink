import { z } from "zod";
import type { Project } from "../io/project.js";
import type { EventCommand } from "../schema/entities.js";

export const SearchEventsInput = z.object({
  query: z.string(),
  scope: z.enum(["all", "common", "map"]).optional(),
});

export const SearchEventsOutput = z.object({
  matches: z.array(
    z.object({
      location: z.string(),
      snippet: z.string(),
    }),
  ),
});

function extractTextFromCommands(commands: EventCommand[]): string[] {
  const texts: string[] = [];
  for (const cmd of commands) {
    if (cmd.code === 101 || cmd.code === 401) {
      for (const p of cmd.parameters) {
        if (typeof p === "string" && p.length > 0) texts.push(p);
      }
    }
    if (cmd.code === 108 || cmd.code === 408) {
      for (const p of cmd.parameters) {
        if (typeof p === "string" && p.length > 0) texts.push(p);
      }
    }
    if (cmd.code === 355 || cmd.code === 655) {
      for (const p of cmd.parameters) {
        if (typeof p === "string" && p.length > 0) texts.push(p);
      }
    }
  }
  return texts;
}

export function searchEvents(project: Project, input: z.infer<typeof SearchEventsInput>) {
  const q = input.query.toLowerCase();
  const matches: { location: string; snippet: string }[] = [];
  const scope = input.scope ?? "all";

  if (scope === "all" || scope === "common") {
    for (const ce of project.model.listEntities("CommonEvent")) {
      const list = (ce as unknown as { list: EventCommand[] }).list ?? [];
      const texts = extractTextFromCommands(list);
      for (const text of texts) {
        if (text.toLowerCase().includes(q)) {
          matches.push({
            location: `CommonEvent:${ce.id}:${ce.name}`,
            snippet: text,
          });
        }
      }
    }
  }

  if (scope === "all" || scope === "map") {
    for (const [mapId, map] of project.model.maps) {
      for (const event of map.events) {
        if (!event) continue;
        for (const page of event.pages) {
          const p = page as { list: EventCommand[] };
          const texts = extractTextFromCommands(p.list);
          for (const text of texts) {
            if (text.toLowerCase().includes(q)) {
              matches.push({
                location: `Map${String(mapId).padStart(3, "0")}:Event${event.id}:${event.name}`,
                snippet: text,
              });
            }
          }
        }
      }
    }
  }

  return { matches };
}
