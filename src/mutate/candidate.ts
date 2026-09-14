import { existsSync, readFileSync } from "node:fs";
import fjp from "fast-json-patch";
import { z } from "zod";
import { StaleProjectError, ValidationError } from "../errors.js";
import { resolveProjectPathSafe } from "../io/paths.js";
import { parsePluginsJs, serializePluginsJs } from "../io/pluginsJs.js";
import type { Project } from "../io/project.js";
import { hashContent, hashFile } from "../model/hash.js";
import { type NormalizedModel, modelFromDocuments } from "../model/normalized.js";
import { assertConstrainedList } from "../schema/commands.js";
import {
  MapEventImageSchema,
  MapEventPageConditionSchema,
  MapEventPageSchema,
  MapEventSchema,
} from "../schema/entities.js";
import { assertSafeKeys, invalid, validateEntityFields } from "../schema/safety.js";
import { validateProject } from "../validate/project.js";
import { buildWritePlans, computeNextIds } from "./patch.js";
import type { Draft, Staging, StagingData } from "./staging.js";

export interface CandidateFile {
  file: string;
  before: string | null;
  after: string | null;
}
export function readText(projectDir: string, file: string): string | null {
  const path = resolveProjectPathSafe(projectDir, file);
  if (!existsSync(path)) return null;
  const bytes = readFileSync(path);
  const text = bytes.toString("utf8");
  if (!bytes.equals(Buffer.from(text))) invalid(`File is not UTF-8: ${file}`);
  return text;
}
export function contentHash(content: string | null): string {
  return content === null ? "" : hashContent(content);
}

export function assertBaseline(project: Project, state: StagingData): void {
  const changed: string[] = [];
  for (const [rel, hash] of Object.entries(state.baseHashes)) {
    const file = resolveProjectPathSafe(project.projectDir, rel);
    if ((existsSync(file) ? hashFile(file) : "") !== hash) changed.push(rel);
  }
  if (changed.length) throw new StaleProjectError(changed);
}

function checkDraft(draft: Draft): void {
  assertSafeKeys(draft);
  if (draft.type === "create" || draft.type === "update") {
    validateEntityFields(
      draft.entityType,
      draft.type === "create" ? draft.fields : draft.patch,
      draft.type === "update",
    );
    if (draft.type === "create" && draft.entityType === "CommonEvent")
      assertConstrainedList(draft.fields.list);
    if (draft.type === "create" && draft.entityType === "Troop") {
      for (const page of draft.fields.pages as { list: unknown }[])
        assertConstrainedList(page.list);
    }
  } else if (draft.type === "createMapEvent") {
    const parsed = MapEventSchema.omit({ id: true }).strict().safeParse(draft.event);
    if (!parsed.success) throw new ValidationError(parsed.error.issues);
    for (const page of parsed.data.pages) {
      assertConstrainedList(page.list);
      if (page.moveRoute.list.some((c) => c.code !== 0))
        invalid("New move routes require a constrained builder");
    }
  } else if (draft.type === "updateMapEvent") {
    const pagePatch = z
      .object({
        index: z.number().int().nonnegative(),
        fields: MapEventPageSchema.omit({ moveRoute: true })
          .partial()
          .extend({
            conditions: MapEventPageConditionSchema.partial().strict().optional(),
            image: MapEventImageSchema.partial().strict().optional(),
          })
          .strict(),
      })
      .strict();
    const parsed = MapEventSchema.omit({ id: true, pages: true })
      .partial()
      .extend({ pagePatch: pagePatch.optional() })
      .strict()
      .safeParse(draft.patch);
    if (!parsed.success) throw new ValidationError(parsed.error.issues);
    if (parsed.data.pagePatch?.fields.list)
      assertConstrainedList(parsed.data.pagePatch.fields.list);
  }
}

// Preview, validation and apply all prepare the same immutable bytes. No disk
// mutation or formula evaluation happens here. The caller holds the project lock.
export function prepareCandidate(project: Project, staging: Staging) {
  const state = staging.read();
  assertBaseline(project, state);
  return replayCandidate(project.model, state, (file) => readText(project.projectDir, file));
}

// Recovery replays the persisted DSL against the captured pre-transaction model.
// This is the same field/command/reference boundary as ordinary preview/apply.
export function replayCandidate(
  model: NormalizedModel,
  state: StagingData,
  read: (file: string) => string | null,
) {
  for (const draft of state.drafts) checkDraft(draft);
  const maxIds = new Map(
    model
      .getEntityTypes()
      .map((type) => [type, model.listEntities(type).reduce((max, e) => Math.max(max, e.id), 0)]),
  );
  const eventIds = new Map(
    [...model.maps].map(([id, map]) => [id, map.events.filter((e) => e !== null).map((e) => e.id)]),
  );
  const plans = buildWritePlans(
    state.drafts,
    computeNextIds(state.drafts, maxIds),
    model.plugins,
    eventIds,
  );
  const documents = structuredClone(model.documents);
  let plugins = structuredClone(model.plugins);
  const files: CandidateFile[] = [];
  const destinations = new Set<string>();
  for (const plan of plans) {
    let file: string;
    let after: string;
    if (plan.kind === "jsonPatch") {
      file = `data/${plan.file}`;
      if (!documents.has(plan.file)) invalid(`Missing referenced file ${file}`);
      const patched = fjp.applyPatch(
        documents.get(plan.file),
        plan.ops,
        true,
        false,
        true,
      ).newDocument;
      documents.set(plan.file, patched);
      after = JSON.stringify(patched);
    } else if (plan.kind === "pluginConfig") {
      file = "js/plugins.js";
      after = serializePluginsJs(plan.entries);
      plugins = parsePluginsJs(after);
    } else {
      file = `js/plugins/${plan.name}.js`;
      after = plan.source;
    }
    const resolved = resolveProjectPathSafe(model.projectDir, file);
    if (destinations.has(resolved.toLowerCase())) invalid(`Conflicting destination: ${file}`);
    destinations.add(resolved.toLowerCase());
    files.push({ file, before: read(file), after });
  }
  const candidateModel = modelFromDocuments(model.projectDir, model.adapter, documents, plugins);
  const validation = validateProject(candidateModel);
  return {
    state,
    plans,
    files,
    model: candidateModel,
    validation,
    revision: hashContent(
      JSON.stringify({ revision: state.revision, files, baseline: state.baseHashes }),
    ),
  };
}
