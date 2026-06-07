import type { z } from "zod";
import type { PluginEntry } from "../io/pluginsJs.js";

export interface WritePlan {
  filePath: string;
  content: string;
}

export interface EngineAdapter {
  readonly id: "mv" | "mz";
  dataFiles(): string[];
  pluginConfig: {
    read(projectDir: string): PluginEntry[];
    write(projectDir: string, entries: PluginEntry[]): WritePlan;
  };
  animationSchema: z.ZodTypeAny;
  pluginCommandModel: "text-357" | "registered";
}
