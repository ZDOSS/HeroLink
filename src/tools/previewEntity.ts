import { z } from "zod";
import { FileChannel } from "../channel/fileChannel.js";
import type { Project } from "../io/project.js";

export const PreviewEntityInput = z.object({
  /**
   * Type of entity to preview.
   */
  type: z.enum(["Item", "Skill"]),
  /**
   * ID of the entity to preview.
   */
  id: z.number().int().positive(),
  /**
   * Timeout in milliseconds when waiting for plugin response.
   */
  timeoutMs: z.number().int().positive().default(5000),
});

export const PreviewEntityOutput = z.object({
  success: z.boolean(),
  entityType: z.string(),
  entityId: z.number(),
  entityName: z.string().nullable(),
  error: z.string().nullable(),
});

export async function previewEntity(project: Project, input: z.infer<typeof PreviewEntityInput>) {
  const channel = new FileChannel(project.projectDir);

  // Check if plugin is installed
  const hasPlugin = project.model.plugins.some((p) => p.name === "BridgeInspector");
  if (!hasPlugin) {
    return {
      success: false,
      entityType: input.type,
      entityId: input.id,
      entityName: null,
      error: "BridgeInspector plugin is not installed. Add it via add_plugin_draft first.",
    };
  }

  // Validate entity exists in project data
  let entityName: string | null = null;

  if (input.type === "Item") {
    const item = project.model.getEntity("Item", input.id);
    if (!item) {
      return {
        success: false,
        entityType: input.type,
        entityId: input.id,
        entityName: null,
        error: `Item with id ${input.id} not found in project.`,
      };
    }
    entityName = item.name;
  } else if (input.type === "Skill") {
    const skill = project.model.getEntity("Skill", input.id);
    if (!skill) {
      return {
        success: false,
        entityType: input.type,
        entityId: input.id,
        entityName: null,
        error: `Skill with id ${input.id} not found in project.`,
      };
    }
    entityName = skill.name;
  }

  // Send preview command to plugin
  const command = input.type === "Item" ? "PREVIEW_ITEM" : "PREVIEW_SKILL";
  const argKey = input.type === "Item" ? "itemId" : "skillId";

  const commandId = channel.sendCommand(command, { [argKey]: input.id });
  const response = await channel.waitForResponse(commandId, input.timeoutMs);

  if (!response) {
    return {
      success: false,
      entityType: input.type,
      entityId: input.id,
      entityName,
      error: "Timeout waiting for plugin response. Is the game running?",
    };
  }

  if (!response.success) {
    return {
      success: false,
      entityType: input.type,
      entityId: input.id,
      entityName,
      error: `Plugin error: ${response.error}`,
    };
  }

  return {
    success: true,
    entityType: input.type,
    entityId: input.id,
    entityName,
    error: null,
  };
}
