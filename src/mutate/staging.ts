import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import writeFileAtomic from "write-file-atomic";
import { z } from "zod";
import { IoError } from "../errors.js";
import { withProjectLock } from "../io/lock.js";
import { resolveProjectPathSafe } from "../io/paths.js";
import { hashFile } from "../model/hash.js";
import type { EntityType } from "../model/normalized.js";
import { EntityTypeSchema, PluginName, assertSafeKeys } from "../schema/safety.js";

export interface CreateDraft {
  type: "create";
  changeId: string;
  entityType: EntityType;
  fields: Record<string, unknown>;
}

export interface UpdateDraft {
  type: "update";
  changeId: string;
  entityType: EntityType;
  entityId: number;
  patch: Record<string, unknown>;
}

export interface CreateMapEventDraft {
  type: "createMapEvent";
  changeId: string;
  mapId: number;
  event: Record<string, unknown>;
}

export interface UpdateMapEventDraft {
  type: "updateMapEvent";
  changeId: string;
  mapId: number;
  eventId: number;
  patch: Record<string, unknown>;
}

export interface SetPluginParamsDraft {
  type: "setPluginParams";
  changeId: string;
  pluginName: string;
  params: Record<string, string>;
}

export interface AddPluginDraft {
  type: "addPlugin";
  changeId: string;
  name: string;
  source: string;
  status: boolean;
  params: Record<string, string>;
}

export type Draft =
  | CreateDraft
  | UpdateDraft
  | CreateMapEventDraft
  | UpdateMapEventDraft
  | SetPluginParamsDraft
  | AddPluginDraft;

const common = { changeId: z.string().uuid() };
const fields = z.record(z.unknown());
const DraftSchema = z.discriminatedUnion("type", [
  z.object({ ...common, type: z.literal("create"), entityType: EntityTypeSchema, fields }).strict(),
  z
    .object({
      ...common,
      type: z.literal("update"),
      entityType: EntityTypeSchema,
      entityId: z.number().int().positive(),
      patch: fields,
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("createMapEvent"),
      mapId: z.number().int().positive(),
      event: fields,
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("updateMapEvent"),
      mapId: z.number().int().positive(),
      eventId: z.number().int().positive(),
      patch: fields,
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("setPluginParams"),
      pluginName: PluginName,
      params: z.record(z.string()),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("addPlugin"),
      name: PluginName,
      source: z.string().min(1),
      status: z.boolean(),
      params: z.record(z.string()),
    })
    .strict(),
]);
export const StagingSchema = z
  .object({
    version: z.literal(1),
    revision: z.string().uuid(),
    drafts: z.array(DraftSchema),
    baseHashes: z.record(z.string().regex(/^(?:[a-f0-9]{64})?$/)),
  })
  .strict();
export type StagingData = z.infer<typeof StagingSchema>;
export function parseStagingData(raw: unknown): StagingData {
  assertSafeKeys(raw);
  return StagingSchema.parse(raw);
}

export class Staging {
  constructor(
    readonly projectDir: string,
    private readonly snapshots: () => Record<string, string> = () => ({}),
  ) {
    this.projectDir = realpathSync(projectDir);
    mkdirSync(resolveProjectPathSafe(this.projectDir, ".bridge"), { recursive: true });
    this.read();
  }
  private path(): string {
    return resolveProjectPathSafe(this.projectDir, ".bridge/staging.json");
  }
  read(): StagingData {
    return withProjectLock(this.projectDir, () => {
      if (!existsSync(this.path()))
        return {
          version: 1,
          revision: "00000000-0000-4000-8000-000000000000",
          drafts: [],
          baseHashes: {},
        };
      try {
        const raw = JSON.parse(readFileSync(this.path(), "utf8"));
        // Empty legacy state is losslessly migratable; pending legacy edits have no
        // staleness baseline. Preserve them and require explicit export/restaging.
        if (!raw.version && Array.isArray(raw.drafts) && raw.drafts.length === 0)
          return {
            version: 1,
            revision: "00000000-0000-4000-8000-000000000000",
            drafts: [],
            baseHashes: {},
          };
        const state = parseStagingData(raw);
        for (const path of Object.keys(state.baseHashes))
          resolveProjectPathSafe(this.projectDir, path);
        for (const draft of state.drafts) assertSafeKeys(draft);
        if (new Set(state.drafts.map((d) => d.changeId)).size !== state.drafts.length)
          throw new Error("Duplicate draft IDs");
        return state;
      } catch (error) {
        throw new IoError(
          this.path(),
          `Invalid or legacy pending staging; preserve and restage explicitly. ${error}`,
        );
      }
    });
  }
  restore(state: StagingData): void {
    withProjectLock(this.projectDir, () => {
      const parsed = parseStagingData(state);
      writeFileAtomic.sync(this.path(), JSON.stringify(parsed, null, 2), "utf8");
    });
  }
  private append(draft: Draft): string {
    return withProjectLock(this.projectDir, () => {
      assertSafeKeys(draft);
      const parsed = DraftSchema.parse(JSON.parse(JSON.stringify(draft)));
      assertSafeKeys(parsed);
      const state = this.read();
      if (state.drafts.length === 0) state.baseHashes = this.snapshots();
      if (parsed.type === "addPlugin") {
        const relative = `js/plugins/${parsed.name}.js`;
        const file = resolveProjectPathSafe(this.projectDir, relative);
        if (!(relative in state.baseHashes))
          state.baseHashes[relative] = existsSync(file) ? hashFile(file) : "";
      }
      state.drafts.push(parsed);
      state.revision = randomUUID();
      this.restore(state);
      return parsed.changeId;
    });
  }
  addCreate(entityType: EntityType, fields: Record<string, unknown>): string {
    return this.append({ type: "create", changeId: randomUUID(), entityType, fields });
  }
  addUpdate(entityType: EntityType, entityId: number, patch: Record<string, unknown>): string {
    return this.append({ type: "update", changeId: randomUUID(), entityType, entityId, patch });
  }
  addCreateMapEvent(mapId: number, event: Record<string, unknown>): string {
    return this.append({ type: "createMapEvent", changeId: randomUUID(), mapId, event });
  }
  addUpdateMapEvent(mapId: number, eventId: number, patch: Record<string, unknown>): string {
    return this.append({ type: "updateMapEvent", changeId: randomUUID(), mapId, eventId, patch });
  }
  addSetPluginParams(pluginName: string, params: Record<string, string>): string {
    return this.append({ type: "setPluginParams", changeId: randomUUID(), pluginName, params });
  }
  addAddPlugin(
    name: string,
    source: string,
    status: boolean,
    params: Record<string, string>,
  ): string {
    return this.append({ type: "addPlugin", changeId: randomUUID(), name, source, status, params });
  }
  // Read on every call: GUI, CLI and MCP sessions share one persisted revision.
  list(): Draft[] {
    return this.read().drafts;
  }
  get(changeId: string): Draft | undefined {
    return this.list().find((d) => d.changeId === changeId);
  }
  discard(changeIds?: string[]): void {
    withProjectLock(this.projectDir, () => {
      const state = this.read();
      state.drafts = changeIds ? state.drafts.filter((d) => !changeIds.includes(d.changeId)) : [];
      if (!state.drafts.length) state.baseHashes = {};
      state.revision = randomUUID();
      this.restore(state);
    });
  }
  clear(state?: StagingData): void {
    if (state) this.restore(state);
    else this.discard();
  }
}
