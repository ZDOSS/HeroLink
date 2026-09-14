import { join } from "node:path";
import { z } from "zod";
import { type PluginEntry, readPluginsJs, serializePluginsJs } from "../io/pluginsJs.js";
import type { EngineAdapter, WritePlan } from "./adapter.js";

import { AudioSchema } from "../schema/entities.js";
import { MvAnimationSchema } from "./mv.js";

// Current MZ exports use Effekseer; imported MV sprite animations remain valid.
// Field shapes are checked against pinned editor exports and the official MZ
// database reference. Never infer effect data from an MV sprite animation.
export const MzAnimationSchema = z.union([
  z
    .object({
      id: z.number().int().positive(),
      name: z.string(),
      displayType: z.number().int(),
      effectName: z.string(),
      offsetX: z.number(),
      offsetY: z.number(),
      rotation: z.object({ x: z.number(), y: z.number(), z: z.number() }),
      scale: z.number(),
      speed: z.number(),
      soundTimings: z.array(z.object({ frame: z.number().int(), se: AudioSchema })),
      flashTimings: z.array(
        z.object({
          frame: z.number().int(),
          duration: z.number().int(),
          color: z.array(z.number()).length(4),
        }),
      ),
    })
    .passthrough(),
  MvAnimationSchema,
]);

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
