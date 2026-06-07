import { z } from "zod";
import type { Project } from "../io/project.js";

export const ListPluginsInput = z.object({});

export const ListPluginsOutput = z.object({
  plugins: z.array(
    z.object({
      name: z.string(),
      status: z.boolean(),
      params: z.record(z.string(), z.string()),
    }),
  ),
});

export function listPlugins(project: Project) {
  const plugins = project.model.plugins.map((p) => ({
    name: p.name,
    status: p.status,
    params: p.parameters,
  }));
  return { plugins };
}
