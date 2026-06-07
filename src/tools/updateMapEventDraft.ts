import { z } from "zod";
import type { Project } from "../io/project.js";
import type { Staging } from "../mutate/staging.js";
import { ConstrainedCommandSchema, compileCommandList } from "../schema/commands.js";

const MapEventPagePatchSchema = z.object({
  conditions: z
    .object({
      actorId: z.number().int(),
      actorValid: z.boolean(),
      itemId: z.number().int(),
      itemValid: z.boolean(),
      selfSwitchCh: z.string(),
      selfSwitchValid: z.boolean(),
      switch1Id: z.number().int(),
      switch1Valid: z.boolean(),
      switch2Id: z.number().int(),
      switch2Valid: z.boolean(),
      variableId: z.number().int(),
      variableValid: z.boolean(),
      variableValue: z.number().int(),
    })
    .partial()
    .optional(),
  commands: z.array(ConstrainedCommandSchema).min(1).optional(),
  directionFix: z.boolean().optional(),
  image: z
    .object({
      tileId: z.number().int(),
      characterName: z.string(),
      characterIndex: z.number().int(),
      direction: z.number().int(),
      pattern: z.number().int(),
    })
    .partial()
    .optional(),
  moveFrequency: z.number().int().optional(),
  moveSpeed: z.number().int().optional(),
  moveType: z.number().int().optional(),
  priorityType: z.number().int().optional(),
  stepAnime: z.boolean().optional(),
  through: z.boolean().optional(),
  trigger: z.number().int().optional(),
  walkAnime: z.boolean().optional(),
});

export const UpdateMapEventDraftInput = z.object({
  mapId: z.number().int().positive(),
  eventId: z.number().int().positive(),
  name: z.string().min(1).optional(),
  x: z.number().int().nonnegative().optional(),
  y: z.number().int().nonnegative().optional(),
  pageIndex: z.number().int().nonnegative().optional(),
  page: MapEventPagePatchSchema.optional(),
  note: z.string().optional(),
});

export const UpdateMapEventDraftOutput = z.object({
  changeId: z.string(),
  preview: z.object({
    mapId: z.number(),
    eventId: z.number(),
    patch: z.record(z.unknown()),
  }),
  validation: z.object({
    ok: z.boolean(),
    issues: z.array(z.string()).optional(),
  }),
});

export function updateMapEventDraft(
  project: Project,
  staging: Staging,
  input: z.infer<typeof UpdateMapEventDraftInput>,
) {
  const map = project.model.maps.get(input.mapId);
  if (!map) {
    throw new Error(`Map ${input.mapId} not found`);
  }

  const event = map.events.find((e) => e !== null && e.id === input.eventId);
  if (!event) {
    throw new Error(`Event ${input.eventId} not found on map ${input.mapId}`);
  }

  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) patch.name = input.name;
  if (input.x !== undefined) patch.x = input.x;
  if (input.y !== undefined) patch.y = input.y;
  if (input.note !== undefined) patch.note = input.note;

  // Validate that page and pageIndex are provided together
  if ((input.page === undefined) !== (input.pageIndex === undefined)) {
    throw new Error(
      `"page" and "pageIndex" must be provided together, but only ${input.page !== undefined ? '"page"' : '"pageIndex"'} was given`,
    );
  }

  if (input.page !== undefined && input.pageIndex !== undefined) {
    const pages = [...(event.pages as unknown as Record<string, unknown>[])];
    if (input.pageIndex >= pages.length) {
      throw new Error(
        `Page index ${input.pageIndex} out of range (event has ${pages.length} pages)`,
      );
    }

    const existingPage = { ...pages[input.pageIndex] } as Record<string, unknown>;

    if (input.page.conditions) {
      existingPage.conditions = {
        ...(existingPage.conditions as Record<string, unknown>),
        ...input.page.conditions,
      };
    }
    if (input.page.commands) {
      existingPage.list = compileCommandList(input.page.commands);
    }
    if (input.page.directionFix !== undefined) existingPage.directionFix = input.page.directionFix;
    if (input.page.image) {
      existingPage.image = {
        ...(existingPage.image as Record<string, unknown>),
        ...input.page.image,
      };
    }
    if (input.page.moveFrequency !== undefined)
      existingPage.moveFrequency = input.page.moveFrequency;
    if (input.page.moveSpeed !== undefined) existingPage.moveSpeed = input.page.moveSpeed;
    if (input.page.moveType !== undefined) existingPage.moveType = input.page.moveType;
    if (input.page.priorityType !== undefined) existingPage.priorityType = input.page.priorityType;
    if (input.page.stepAnime !== undefined) existingPage.stepAnime = input.page.stepAnime;
    if (input.page.through !== undefined) existingPage.through = input.page.through;
    if (input.page.trigger !== undefined) existingPage.trigger = input.page.trigger;
    if (input.page.walkAnime !== undefined) existingPage.walkAnime = input.page.walkAnime;

    pages[input.pageIndex] = existingPage;
    patch.pages = pages;
  }

  const changeId = staging.addUpdateMapEvent(input.mapId, input.eventId, patch);

  return {
    changeId,
    preview: {
      mapId: input.mapId,
      eventId: input.eventId,
      patch,
    },
    validation: { ok: true },
  };
}
