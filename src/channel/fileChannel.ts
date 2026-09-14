import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmdirSync } from "node:fs";
import writeFileAtomic from "write-file-atomic";
import { z } from "zod";
import { ConflictError, IoError } from "../errors.js";
import { resolveProjectPathSafe } from "../io/paths.js";

const CommandSchema = z
  .object({
    id: z.string().uuid(),
    command: z.enum(["INSPECT", "PREVIEW_ITEM", "PREVIEW_SKILL", "CLEAR_PREVIEW"]),
    args: z.record(z.unknown()).optional(),
    expiresAt: z.number().int().positive(),
  })
  .strict();
const ResponseSchema = z.object({
  id: z.string().uuid().nullable(),
  command: z.string(),
  success: z.boolean(),
  result: z.unknown(),
  error: z.string().nullable(),
});
export const RuntimeStateSchema = z.object({
  timestamp: z.number().finite(),
  game: z.object({ title: z.string(), versionId: z.number() }).nullable(),
  party: z
    .object({
      members: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          level: z.number(),
          hp: z.number(),
          mp: z.number(),
          tp: z.number(),
        }),
      ),
      gold: z.number(),
    })
    .nullable(),
  map: z
    .object({
      mapId: z.number(),
      displayName: z.string(),
      playerX: z.number().nullable(),
      playerY: z.number().nullable(),
      playerDirection: z.number().nullable(),
    })
    .nullable(),
  switches: z.array(z.boolean()).nullable(),
  variables: z.array(z.unknown()).nullable(),
});
export type BridgeCommand = z.infer<typeof CommandSchema>;
export type BridgeResponse = z.infer<typeof ResponseSchema>;
export type RuntimeState = z.infer<typeof RuntimeStateSchema>;

export class FileChannel {
  constructor(
    private readonly projectDir: string,
    private readonly channelSubdir = ".bridge",
  ) {
    this.projectDir = realpathSync(projectDir);
    z.string()
      .regex(/^\.bridge(?:\/[A-Za-z0-9_-]+)*$/)
      .parse(channelSubdir);
    this.path("");
  }
  private path(name: string): string {
    return resolveProjectPathSafe(this.projectDir, `${this.channelSubdir}/${name}`);
  }
  ensureDirectory(): void {
    mkdirSync(this.path(""), { recursive: true });
  }
  private read<T>(name: string, schema: z.ZodType<T>, missing: T): T {
    if (!existsSync(this.path(name))) return missing;
    try {
      return schema.parse(JSON.parse(readFileSync(this.path(name), "utf8")));
    } catch (error) {
      throw new IoError(this.path(name), error);
    }
  }
  private write(name: string, value: unknown): void {
    writeFileAtomic.sync(this.path(name), JSON.stringify(value, null, 2), "utf8");
  }
  readRuntimeState(): RuntimeState | null {
    return this.read("runtime-state.json", RuntimeStateSchema.nullable(), null);
  }
  private readCommands(): BridgeCommand[] {
    return this.read("commands.json", CommandSchema.array(), []);
  }
  readResponses(): BridgeResponse[] {
    return this.read("responses.json", ResponseSchema.array(), []);
  }
  // Both peers use atomic mkdir and fail closed on contention. Abandoned locks
  // are never stolen from a potentially paused peer; recovery requires stopping
  // the game and bridge, then removing the empty commands.lock/responses.lock.
  private acquire(name: string): boolean {
    this.ensureDirectory();
    try {
      mkdirSync(this.path(`${name}.lock`));
      return true;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") return false;
      throw error;
    }
  }
  private release(name: string): void {
    rmdirSync(this.path(`${name}.lock`));
  }
  sendCommand(command: string, args?: Record<string, unknown>, timeoutMs = 5000): string {
    return this.sendCommands([{ command, args }], timeoutMs)[0];
  }
  sendCommands(
    commands: Array<{ command: string; args?: Record<string, unknown> }>,
    timeoutMs = 5000,
  ): string[] {
    z.number().int().positive().max(60000).parse(timeoutMs);
    const pending = commands.map((cmd) =>
      CommandSchema.parse({ ...cmd, id: randomUUID(), expiresAt: Date.now() + timeoutMs }),
    );
    const acquired = this.acquire("commands");
    if (!acquired)
      throw new ConflictError(
        "Runtime commands are locked; retry after the game releases the lock",
      );
    try {
      this.write("commands.json", [
        ...this.readCommands().filter((c) => c.expiresAt > Date.now()),
        ...pending,
      ]);
    } finally {
      this.release("commands");
    }
    return pending.map((c) => c.id);
  }
  consumeResponses(): BridgeResponse[] {
    const acquired = this.acquire("responses");
    if (!acquired) throw new ConflictError("Runtime responses are locked");
    try {
      const responses = this.readResponses();
      this.write("responses.json", []);
      return responses;
    } finally {
      this.release("responses");
    }
  }
  async waitForResponse(commandId: string, timeoutMs = 5000): Promise<BridgeResponse | null> {
    z.string().uuid().parse(commandId);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const acquired = this.acquire("responses");
      if (!acquired) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(25, Math.max(1, deadline - Date.now()))),
        );
        continue;
      }
      try {
        const responses = this.readResponses();
        const response = responses.find((r) => r.id === commandId);
        if (response) {
          this.write(
            "responses.json",
            responses.filter((r) => r.id !== commandId),
          );
          return response;
        }
      } finally {
        this.release("responses");
      }
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(25, Math.max(1, deadline - Date.now()))),
      );
    }
    // Each ID has its own atomic cancellation tombstone, independent of shared
    // locks. The plugin checks this AND enqueue-time expiry before execution.
    this.write(`${commandId}.cancelled`, { cancelled: true });
    const acquired = this.acquire("commands");
    if (!acquired) return null;
    try {
      this.write(
        "commands.json",
        this.readCommands().filter((c) => c.id !== commandId),
      );
    } finally {
      this.release("commands");
    }
    return null;
  }
  clear(): void {
    const commands = this.acquire("commands");
    if (!commands) throw new ConflictError("Runtime commands are locked");
    try {
      const responses = this.acquire("responses");
      if (!responses) throw new ConflictError("Runtime responses are locked");
      try {
        this.write("commands.json", []);
        this.write("responses.json", []);
      } finally {
        this.release("responses");
      }
    } finally {
      this.release("commands");
    }
    // Runtime state has a single writer (the plugin); the bridge never overwrites it.
  }
}
