import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { z } from "zod";

export const ConfigSchema = z
  .object({
    projectPath: z.string().min(1).nullable().default(null),
    port: z.number().int().min(1).max(65535).default(8866),
    host: z.enum(["127.0.0.1", "localhost", "::1"]).default("127.0.0.1"),
    autoStartServer: z.boolean().default(true),
    confirmBeforeApply: z.boolean().default(true),
    windowBounds: z
      .object({
        x: z.number().int().optional(),
        y: z.number().int().optional(),
        width: z.number().int().min(900).default(1100),
        height: z.number().int().min(650).default(750),
      })
      .default({}),
    lastView: z
      .enum([
        "dashboard",
        "ai",
        "entities",
        "maps",
        "plugins",
        "pending",
        "backups",
        "tools",
        "docs",
        "logs",
        "settings",
      ])
      .default("dashboard"),
  })
  .strict();
export const defaults = ConfigSchema.parse({});
export function createStore(file) {
  let cached;
  function load() {
    cached = existsSync(file)
      ? ConfigSchema.parse(JSON.parse(readFileSync(file, "utf8")))
      : structuredClone(defaults);
    return structuredClone(cached);
  }
  function get() {
    return cached ? structuredClone(cached) : load();
  }
  function set(partial) {
    const validated = ConfigSchema.partial().parse(partial);
    const next = ConfigSchema.parse({ ...get(), ...validated });
    mkdirSync(dirname(file), { recursive: true });
    writeFileAtomic.sync(file, JSON.stringify(next, null, 2), "utf8");
    // A failed persistence must not change the next get() result.
    cached = next;
    return get();
  }
  return { get, set, load };
}
