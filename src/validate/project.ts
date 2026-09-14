import { z } from "zod";
import type { RefIssue } from "../errors.js";
import type { NormalizedModel } from "../model/normalized.js";
import { entityFile } from "../mutate/patch.js";
import { MapEventSchema, MapInfoSchema } from "../schema/entities.js";
import { SystemSchema, TilesetSchema } from "../schema/project.js";
import { entitySchemas } from "../schema/safety.js";
import { validateExtendedReferences } from "./extended.js";
import { validateReferences } from "./refs.js";

export interface ValidationResult {
  ok: boolean;
  issues: RefIssue[];
}

export function validateProject(model: NormalizedModel): ValidationResult {
  const issues: RefIssue[] = [];
  const shape = (schema: z.ZodTypeAny, data: unknown, location: string) => {
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      for (const error of parsed.error.issues)
        issues.push({
          severity: "error",
          location: `${location}.${error.path.join(".")}`,
          message: error.message,
          refKind: "schema",
        });
  };
  for (const type of model.getEntityTypes()) {
    const schema =
      type === "Animation"
        ? model.adapter.animationSchema
        : type === "Tileset"
          ? TilesetSchema
          : entitySchemas[type];
    shape(
      z.array(
        (schema ?? z.object({ id: z.number().int().positive(), name: z.string() })).nullable(),
      ),
      model.documents.get(entityFile(type)),
      type,
    );
  }
  shape(SystemSchema, model.system, "System");
  shape(z.array(MapInfoSchema.nullable()), model.documents.get("MapInfos.json"), "MapInfos");
  for (const [id, map] of model.maps)
    shape(
      z
        .object({
          width: z.number().int().positive(),
          height: z.number().int().positive(),
          tilesetId: z.number().int().positive(),
          events: z.array(MapEventSchema.nullable()),
          data: z.array(z.number().int()),
        })
        .refine(
          (map) => map.data.length === map.width * map.height * 6,
          "Map tile data length must match width × height × 6",
        ),
      map,
      `Map:${id}`,
    );
  if (!issues.length)
    issues.push(...validateReferences(model), ...validateExtendedReferences(model));
  const ok = !issues.some((i) => i.severity === "error");
  return { ok, issues };
}
