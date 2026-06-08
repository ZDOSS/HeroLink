import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { EngineAdapter } from "../engine/adapter.js";
import { MvAdapter } from "../engine/mv.js";
import { MzAdapter } from "../engine/mz.js";
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

const MV_MARKER = "Game.rpgproject";
const MZ_MARKER = "Game.mzproject";

function detectAdapter(projectDir: string): EngineAdapter {
  if (existsSync(join(projectDir, MZ_MARKER))) {
    return new MzAdapter();
  }
  return new MvAdapter();
}

export function findProjectDir(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, MV_MARKER)) || existsSync(join(dir, MZ_MARKER))) {
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
  if (!existsSync(join(projectDir, MV_MARKER)) && !existsSync(join(projectDir, MZ_MARKER))) {
    throw new ProjectNotFoundError(projectDir);
  }

  const engineAdapter = adapter ?? detectAdapter(projectDir);

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
