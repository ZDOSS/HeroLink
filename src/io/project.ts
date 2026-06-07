import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { EngineAdapter } from "../engine/adapter.js";
import { MvAdapter } from "../engine/mv.js";
import { ProjectNotFoundError } from "../errors.js";
import { logger } from "../log.js";
import { type NormalizedModel, buildNormalizedModel } from "../model/normalized.js";
import { Staging } from "../mutate/staging.js";

export interface Project {
  projectDir: string;
  adapter: EngineAdapter;
  model: NormalizedModel;
  staging: Staging;
}

export function findProjectDir(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, "Game.rpgproject"))) {
      return dir;
    }
    const parent = join(dir, "..");
    if (parent === dir) {
      throw new ProjectNotFoundError(startDir);
    }
    dir = parent;
  }
}

export function loadProject(projectDir: string, adapter?: EngineAdapter): Project {
  if (!existsSync(join(projectDir, "Game.rpgproject"))) {
    throw new ProjectNotFoundError(projectDir);
  }

  const engineAdapter = adapter ?? new MvAdapter();

  const bridgeDir = join(projectDir, ".bridge");
  if (!existsSync(bridgeDir)) {
    mkdirSync(bridgeDir, { recursive: true });
    logger.info({ bridgeDir }, "Created .bridge directory");
  }

  const model = buildNormalizedModel(projectDir, engineAdapter);
  const staging = new Staging(projectDir);

  return {
    projectDir,
    adapter: engineAdapter,
    model,
    staging,
  };
}
