import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import writeFileAtomic from "write-file-atomic";
import type { EntityType } from "../model/normalized.js";

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

export interface StagingData {
  drafts: Draft[];
}

export class Staging {
  private drafts: Draft[] = [];
  private readonly stagingPath: string;

  constructor(projectDir: string) {
    const bridgeDir = join(projectDir, ".bridge");
    if (!existsSync(bridgeDir)) {
      mkdirSync(bridgeDir, { recursive: true });
    }
    this.stagingPath = join(bridgeDir, "staging.json");
    this.load();
  }

  private load(): void {
    if (existsSync(this.stagingPath)) {
      try {
        const data = JSON.parse(readFileSync(this.stagingPath, "utf-8")) as StagingData;
        this.drafts = data.drafts;
      } catch {
        // If staging.json is corrupted, start with an empty draft list
        this.drafts = [];
      }
    }
  }

  private save(): void {
    const data: StagingData = { drafts: this.drafts };
    writeFileAtomic.sync(this.stagingPath, JSON.stringify(data, null, 2), "utf-8");
  }

  addCreate(entityType: EntityType, fields: Record<string, unknown>): string {
    const changeId = randomUUID();
    const draft: CreateDraft = { type: "create", changeId, entityType, fields };
    this.drafts.push(draft);
    this.save();
    return changeId;
  }

  addUpdate(entityType: EntityType, entityId: number, patch: Record<string, unknown>): string {
    const changeId = randomUUID();
    const draft: UpdateDraft = { type: "update", changeId, entityType, entityId, patch };
    this.drafts.push(draft);
    this.save();
    return changeId;
  }

  addCreateMapEvent(mapId: number, event: Record<string, unknown>): string {
    const changeId = randomUUID();
    const draft: CreateMapEventDraft = { type: "createMapEvent", changeId, mapId, event };
    this.drafts.push(draft);
    this.save();
    return changeId;
  }

  addUpdateMapEvent(mapId: number, eventId: number, patch: Record<string, unknown>): string {
    const changeId = randomUUID();
    const draft: UpdateMapEventDraft = { type: "updateMapEvent", changeId, mapId, eventId, patch };
    this.drafts.push(draft);
    this.save();
    return changeId;
  }

  addSetPluginParams(pluginName: string, params: Record<string, string>): string {
    const changeId = randomUUID();
    const draft: SetPluginParamsDraft = { type: "setPluginParams", changeId, pluginName, params };
    this.drafts.push(draft);
    this.save();
    return changeId;
  }

  addAddPlugin(
    name: string,
    source: string,
    status: boolean,
    params: Record<string, string>,
  ): string {
    const changeId = randomUUID();
    const draft: AddPluginDraft = { type: "addPlugin", changeId, name, source, status, params };
    this.drafts.push(draft);
    this.save();
    return changeId;
  }

  list(): Draft[] {
    return [...this.drafts];
  }

  get(changeId: string): Draft | undefined {
    return this.drafts.find((d) => d.changeId === changeId);
  }

  discard(changeIds?: string[]): void {
    if (!changeIds) {
      this.drafts = [];
    } else {
      this.drafts = this.drafts.filter((d) => !changeIds.includes(d.changeId));
    }
    this.save();
  }

  clear(): void {
    this.drafts = [];
    this.save();
  }
}
