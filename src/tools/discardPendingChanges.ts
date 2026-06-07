import { z } from "zod";
import type { Staging } from "../mutate/staging.js";

export const DiscardPendingChangesInput = z.object({
  changeIds: z.array(z.string()).optional(),
});

export const DiscardPendingChangesOutput = z.object({
  remaining: z.number(),
});

export function discardPendingChanges(
  _project: unknown,
  staging: Staging,
  input: z.infer<typeof DiscardPendingChangesInput>,
) {
  staging.discard(input.changeIds);
  return { remaining: staging.list().length };
}
