import { join } from "node:path";
import { z } from "zod";
import { type PluginEntry, readPluginsJs, serializePluginsJs } from "../io/pluginsJs.js";
import type { EngineAdapter, WritePlan } from "./adapter.js";

// MZ uses Effekseer-based animation format instead of MV's sprite frames
const MzAnimationSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    animation1Name: z.string(),
    animation1Hue: z.number().int(),
    animation2Name: z.string(),
    animation2Hue: z.number().int(),
    position: z.number().int(),
    effectName: z.string(),
    effekseerFlags: z.number().int(),
    frames: z.array(z.array(z.array(z.number().int()))),
    timings: z.array(z.unknown()),
    note: z.string(),
  })
  .passthrough();

export class MzAdapter implements EngineAdapter {
  readonly id = "mz" as const;

  dataFiles(): string[] {
    return [
      "Actors.json",
      "Classes.json",
      "Skills.json",
      "Items.json",
      "Weapons.json",
      "Armors.json",
      "Enemies.json",
      "Troops.json",
      "States.json",
      "Animations.json",
      "Tilesets.json",
      "CommonEvents.json",
      "System.json",
      "MapInfos.json",
    ];
  }

  pluginConfig = {
    read(projectDir: string): PluginEntry[] {
      return readPluginsJs(projectDir);
    },
    write(_projectDir: string, entries: PluginEntry[]): WritePlan {
      return {
        filePath: join(_projectDir, "js", "plugins.js"),
        content: serializePluginsJs(entries),
      };
    },
  };

  animationSchema = MzAnimationSchema;

  pluginCommandModel = "registered" as const;
}
