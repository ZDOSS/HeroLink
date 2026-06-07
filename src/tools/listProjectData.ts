import { z } from "zod";
import type { Project } from "../io/project.js";

export const ListProjectDataInput = z.object({});

export const ListProjectDataOutput = z.object({
  counts: z.record(z.string(), z.number()),
  mapCount: z.number(),
  pluginCount: z.number(),
});

export function listProjectData(project: Project) {
  const counts: Record<string, number> = {};
  for (const type of project.model.getEntityTypes()) {
    counts[type] = project.model.listEntities(type).length;
  }
  return {
    counts,
    mapCount: project.model.listMapInfos().length,
    pluginCount: project.model.plugins.length,
  };
}
