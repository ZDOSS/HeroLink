import { z } from "zod";
import { FileChannel } from "../channel/fileChannel.js";
import type { Project } from "../io/project.js";

export const InspectRuntimeInput = z.object({
  /**
   * If true, send an INSPECT command to the plugin to refresh state.
   * If false, read the last cached state.
   */
  refresh: z.boolean().default(false),
  /**
   * Timeout in milliseconds when waiting for plugin response.
   */
  timeoutMs: z.number().int().positive().default(5000),
});

export const InspectRuntimeOutput = z.object({
  available: z.boolean(),
  state: z
    .object({
      timestamp: z.number(),
      game: z
        .object({
          title: z.string(),
          versionId: z.number(),
        })
        .nullable(),
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
      variables: z.array(z.number()).nullable(),
    })
    .nullable(),
  error: z.string().nullable(),
});

export async function inspectRuntime(project: Project, input: z.infer<typeof InspectRuntimeInput>) {
  const channel = new FileChannel(project.projectDir);

  // Check if plugin is installed
  const hasPlugin = project.model.plugins.some((p) => p.name === "BridgeInspector" && p.status);
  if (!hasPlugin) {
    const installed = project.model.plugins.some((p) => p.name === "BridgeInspector");
    const message = installed
      ? "BridgeInspector plugin is installed but disabled. Enable it in the plugin manager."
      : "BridgeInspector plugin is not installed. Add it via add_plugin_draft first.";
    return {
      available: false,
      state: null,
      error: message,
    };
  }

  // If refresh requested, send INSPECT command
  if (input.refresh) {
    const commandId = channel.sendCommand("INSPECT");
    const response = await channel.waitForResponse(commandId, input.timeoutMs);

    if (!response) {
      return {
        available: true,
        state: null,
        error: "Timeout waiting for plugin response. Is the game running?",
      };
    }

    if (!response.success) {
      return {
        available: true,
        state: null,
        error: `Plugin error: ${response.error}`,
      };
    }
  }

  // Read runtime state
  const state = channel.readRuntimeState();

  if (!state) {
    return {
      available: true,
      state: null,
      error: "No runtime state available. Run the game with BridgeInspector plugin enabled.",
    };
  }

  return {
    available: true,
    state,
    error: null,
  };
}
