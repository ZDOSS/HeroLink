import { z } from "zod";
import { NotFoundError } from "../errors.js";
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
  rawInput: z.infer<typeof UpdateMapEventDraftInput>,
) {
  const input = UpdateMapEventDraftInput.parse(rawInput);
  const map = project.model.maps.get(input.mapId);
  if (!map) {
    throw new NotFoundError(`Map ${input.mapId} not found`);
  }

  const event = map.events.find((e) => e !== null && e.id === input.eventId);
  if (!event) {
    throw new NotFoundError(`Event ${input.eventId} not found on map ${input.mapId}`);
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

    const { commands, ...pageFields } = input.page;
    const fields: Record<string, unknown> = { ...pageFields };
    if (commands) fields.list = compileCommandList(commands);
    // Store the user's granular edit; sequential drafts compose at apply time.
    patch.pagePatch = { index: input.pageIndex, fields };
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
