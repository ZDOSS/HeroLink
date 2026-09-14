import { z } from "zod";

// Validate the engine fields consumed by loading and reference validation;
// preserve additional MV/MZ and plugin fields without inventing defaults.
export const SystemSchema = z
  .object({
    gameTitle: z.string(),
    versionId: z.number().int(),
    elements: z.array(z.string()),
    skillTypes: z.array(z.string()),
    weaponTypes: z.array(z.string()),
    armorTypes: z.array(z.string()),
    equipTypes: z.array(z.string()),
    switches: z.array(z.string()),
    variables: z.array(z.string()),
    partyMembers: z.array(z.number().int().positive()),
    startMapId: z.number().int().positive(),
    startX: z.number().int().nonnegative(),
    startY: z.number().int().nonnegative(),
  })
  .passthrough();
export const TilesetSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    mode: z.number().int(),
    tilesetNames: z.array(z.string()),
    flags: z.array(z.number().int()),
    note: z.string(),
  })
  .passthrough();
