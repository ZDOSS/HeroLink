import { z } from "zod";
import type { Project } from "../io/project.js";
import type { Staging } from "../mutate/staging.js";
import { ConstrainedCommandSchema, compileCommandList } from "../schema/commands.js";

const MapEventPageSchema = z.object({
  conditions: z
    .object({
      actorId: z.number().int().default(1),
      actorValid: z.boolean().default(false),
      itemId: z.number().int().default(1),
      itemValid: z.boolean().default(false),
      selfSwitchCh: z.string().default("A"),
      selfSwitchValid: z.boolean().default(false),
      switch1Id: z.number().int().default(1),
      switch1Valid: z.boolean().default(false),
      switch2Id: z.number().int().default(1),
      switch2Valid: z.boolean().default(false),
      variableId: z.number().int().default(1),
      variableValid: z.boolean().default(false),
      variableValue: z.number().int().default(0),
    })
    .default({}),
  commands: z.array(ConstrainedCommandSchema).min(1),
  directionFix: z.boolean().default(false),
  image: z
    .object({
      tileId: z.number().int().default(0),
      characterName: z.string().default(""),
      characterIndex: z.number().int().default(0),
      direction: z.number().int().default(2),
      pattern: z.number().int().default(0),
    })
    .default({}),
  moveFrequency: z.number().int().default(3),
  moveSpeed: z.number().int().default(3),
  moveType: z.number().int().default(0),
  priorityType: z.number().int().default(0),
  stepAnime: z.boolean().default(false),
  through: z.boolean().default(false),
  trigger: z.number().int().default(0),
  walkAnime: z.boolean().default(true),
});

export const CreateMapEventDraftInput = z.object({
  mapId: z.number().int().positive(),
  name: z.string().min(1),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  pages: z.array(MapEventPageSchema).min(1),
  note: z.string().default(""),
});

export const CreateMapEventDraftOutput = z.object({
  changeId: z.string(),
  preview: z.object({
    mapId: z.number(),
    event: z.record(z.unknown()),
  }),
  validation: z.object({
    ok: z.boolean(),
    issues: z.array(z.string()).optional(),
  }),
});

export function createMapEventDraft(
  project: Project,
  staging: Staging,
  input: z.infer<typeof CreateMapEventDraftInput>,
) {
  const map = project.model.maps.get(input.mapId);
  if (!map) {
    throw new Error(`Map ${input.mapId} not found`);
  }

  const pages = input.pages.map((page) => ({
    conditions: page.conditions,
    directionFix: page.directionFix,
    image: page.image,
    list: compileCommandList(page.commands),
    moveFrequency: page.moveFrequency,
    moveRoute: {
      list: [{ code: 0, indent: 0, parameters: [] }],
      repeat: true,
      skippable: false,
      wait: false,
    },
    moveSpeed: page.moveSpeed,
    moveType: page.moveType,
    priorityType: page.priorityType,
    stepAnime: page.stepAnime,
    through: page.through,
    trigger: page.trigger,
    walkAnime: page.walkAnime,
  }));

  const event = {
    name: input.name,
    x: input.x,
    y: input.y,
    pages,
    note: input.note,
  };

  const changeId = staging.addCreateMapEvent(input.mapId, event);

  const existingEvents = project.model.getMapEvents(input.mapId);
  const maxPersistedId = existingEvents.reduce((max, e) => Math.max(max, e.id), 0);
  const pendingCreates = staging
    .list()
    .filter((d) => d.type === "createMapEvent" && d.mapId === input.mapId).length;
  const nextId = maxPersistedId + pendingCreates;

  return {
    changeId,
    preview: {
      mapId: input.mapId,
      event: { ...event, id: nextId },
    },
    validation: { ok: true },
  };
}
