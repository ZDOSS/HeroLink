import { z } from "zod";
import type { Project } from "../io/project.js";

export const ListMapsInput = z.object({});

export const ListMapsOutput = z.object({
  maps: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      parentId: z.number(),
      order: z.number(),
    }),
  ),
});

export function listMaps(project: Project) {
  const maps = project.model.listMapInfos().map((m) => ({
    id: m.id,
    name: m.name,
    parentId: m.parentId,
    order: m.order,
  }));
  return { maps };
}
